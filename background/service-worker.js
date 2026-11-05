/**
 * PwKaraWeb Excel Exporter - Background Service Worker
 * Coordinates background export execution, download management,
 * tab communication, and state persistence.
 */

import { ExportManager, EXPORT_STATUS } from '../modules/export-manager.js';
import { downloadFile, checkIfFileExists } from '../modules/download-manager.js';
import { loadSettings, saveSettings, loadActiveJobState } from '../modules/storage-manager.js';

let activeExportManager = null;
let activeTabId = null;

/**
 * Finds the PwKaraWeb reporting tab.
 * Prefers the currently active tab if on target, otherwise finds any open target tab.
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function findTargetTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null;

  // 1. Check current active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.url && activeTab.url.includes('172.26.87.8:8091')) {
    return activeTab;
  }

  // 2. Search all tabs across all windows
  const tabs = await chrome.tabs.query({ url: '*://172.26.87.8:8091/*' });
  if (tabs && tabs.length > 0) {
    // Prefer tab on KarkardSummary
    const summaryTab = tabs.find(t => t.url && t.url.toLowerCase().includes('/karareports/karkardsummary'));
    return summaryTab || tabs[0];
  }

  return null;
}

/**
 * Ensures content script is injected and ready in the target tab.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function ensureContentScriptReady(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
    if (response && response.status === 'ok') return true;
  } catch (err) {
    // If ping fails, inject content script dynamically via scripting API
    try {
      if (chrome.scripting && chrome.scripting.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/page-detector.js']
        });
        // Short pause to initialize
        await new Promise(r => setTimeout(r, 200));
        return true;
      }
    } catch (injErr) {
      console.warn('Dynamic script injection failed:', injErr);
    }
  }
  return false;
}

/**
 * Inspects the current PwKaraWeb tab.
 * @returns {Promise<Object>}
 */
async function inspectTargetTab() {
  const tab = await findTargetTab();
  if (!tab) {
    return {
      connected: false,
      tabFound: false,
      error: 'هیچ زبانه باز شده‌ای با آدرس سامانه کارا (172.26.87.8:8091) یافت نشد.'
    };
  }

  activeTabId = tab.id;
  await ensureContentScriptReady(tab.id);

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'INSPECT_PAGE' });
    if (res && res.success) {
      return {
        connected: true,
        tabFound: true,
        tabId: tab.id,
        tabUrl: tab.url,
        ...res.diagnostics
      };
    }
    return {
      connected: false,
      tabFound: true,
      tabId: tab.id,
      tabUrl: tab.url,
      error: res ? res.error : 'عدم دریافت پاسخ از اسکریپت صفحه'
    };
  } catch (err) {
    return {
      connected: false,
      tabFound: true,
      tabId: tab.id,
      tabUrl: tab.url,
      error: `امکان ارتباط با صفحه وجود ندارد: ${err.message}`
    };
  }
}

/**
 * Initializes and starts the export manager for a batch request.
 * @param {Object} params - { year, month, startDay, endDay, settings }
 * @returns {Promise<Object>}
 */
async function handleStartExport(params) {
  const tabDiagnostics = await inspectTargetTab();
  if (!tabDiagnostics.tabFound) {
    throw new Error('صفحه سامانه کارا باز نیست. لطفاً ابتدا به سامانه وارد شوید.');
  }

  if (!tabDiagnostics.formFound) {
    throw new Error('فرم گزارش کارکرد در صفحه یافت نشد. لطفاً به صفحه گزارشات مراجعه کنید.');
  }

  if (!tabDiagnostics.tokenFound) {
    throw new Error('توکن ضد جعل (__RequestVerificationToken) یافت نشد. ممکن است نشست کاربری منقضی شده باشد.');
  }

  if (!tabDiagnostics.excelBtnFound) {
    throw new Error('دکمه ایجاد خروجی اکسل در فرم یافت نشد.');
  }

  const tabId = tabDiagnostics.tabId;
  const actionUrl = tabDiagnostics.actionUrl;
  const btnName = tabDiagnostics.btnName;
  const btnValue = tabDiagnostics.btnValue;

  if (activeExportManager && activeExportManager.state === EXPORT_STATUS.RUNNING) {
    throw new Error('یک فرآیند استخراج هم‌اکنون در حال اجرا است.');
  }

  // Create ExportManager instance
  activeExportManager = new ExportManager({
    fetchHandler: async (dayItem) => {
      // Delegate authenticated fetch to the page's own content script context
      const res = await chrome.tabs.sendMessage(tabId, {
        action: 'FETCH_SINGLE_DAY',
        payload: {
          slashDate: dayItem.slashDate,
          actionUrl,
          btnName,
          btnValue
        }
      });

      if (!res || !res.success) {
        throw new Error(res ? res.error : 'عدم دریافت پاسخ از صفحه سامانه');
      }

      return {
        dataUrl: res.dataUrl,
        size: res.size,
        contentType: res.contentType
      };
    },
    downloadHandler: async ({ url, filename, conflictAction, isBlobUrl }) => {
      return await downloadFile({ url, filename, conflictAction, isBlobUrl });
    },
    checkExistsHandler: async (filename) => {
      return await checkIfFileExists(filename);
    },
    onProgress: (statusPayload) => {
      // Broadcast to any active popup listeners
      chrome.runtime.sendMessage({
        action: 'EXPORT_PROGRESS_UPDATE',
        payload: statusPayload
      }).catch(() => {
        // Ignored if popup is currently closed
      });
    }
  });

  // Run in background asynchronously so response returns immediately
  activeExportManager.startExport({
    year: params.year,
    month: params.month,
    startDay: params.startDay,
    endDay: params.endDay,
    settings: params.settings
  }).catch((err) => {
    console.error('Export manager terminated with error:', err);
  });

  return activeExportManager.getStatus();
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  switch (message.action) {
    case 'INSPECT_STATUS':
      inspectTargetTab()
        .then(diag => {
          const exportStatus = activeExportManager ? activeExportManager.getStatus() : { state: EXPORT_STATUS.IDLE };
          sendResponse({ success: true, diagnostics: diag, exportStatus });
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'START_EXPORT':
      handleStartExport(message.payload)
        .then(status => sendResponse({ success: true, status }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'PAUSE_EXPORT':
      if (activeExportManager) {
        activeExportManager.pauseExport();
        sendResponse({ success: true, status: activeExportManager.getStatus() });
      } else {
        sendResponse({ success: false, error: 'هیچ عملیات فعالی وجود ندارد.' });
      }
      return false;

    case 'RESUME_EXPORT':
      if (activeExportManager) {
        activeExportManager.resumeExport();
        sendResponse({ success: true, status: activeExportManager.getStatus() });
      } else {
        sendResponse({ success: false, error: 'هیچ عملیات متوقفی وجود ندارد.' });
      }
      return false;

    case 'STOP_EXPORT':
      if (activeExportManager) {
        activeExportManager.stopExport();
        sendResponse({ success: true, status: activeExportManager.getStatus() });
      } else {
        sendResponse({ success: false, error: 'هیچ عملیات فعالی وجود ندارد.' });
      }
      return false;

    case 'GET_EXPORT_STATUS':
      if (activeExportManager) {
        sendResponse({ success: true, status: activeExportManager.getStatus() });
      } else {
        loadActiveJobState().then(savedJob => {
          sendResponse({
            success: true,
            status: {
              state: savedJob ? savedJob.status : EXPORT_STATUS.IDLE,
              inFlight: false,
              job: savedJob
            }
          });
        });
        return true;
      }
      return false;

    default:
      return false;
  }
});

// Extension install / startup hook
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[PwKaraWeb Exporter] Installed / Updated:', details.reason);
  // Ensure default settings are loaded
  await loadSettings();
});
