/**
 * PwKaraWeb Excel Exporter - Storage Manager
 * Handles persistence of extension settings, active job state,
 * and export history using chrome.storage.local with mock support for tests.
 */

import { DEFAULT_FILENAME_TEMPLATE, DEFAULT_PREFIX } from './filename-manager.js';
import {
  FOLDER_MODES,
  MONTH_NAMING_STYLES,
  DEFAULT_ROOT_FOLDER,
  DEFAULT_FOLDER_MODE,
  DEFAULT_MONTH_STYLE
} from './folder-manager.js';
import { DEFAULT_DELAY_SECONDS } from './validation.js';

export const CONFLICT_ACTIONS = {
  UNIQUIFY: 'uniquify',
  OVERWRITE: 'overwrite',
  PROMPT: 'prompt'
};

export const DEFAULT_SETTINGS = {
  filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
  filenamePrefix: DEFAULT_PREFIX,
  folderMode: DEFAULT_FOLDER_MODE,
  rootFolder: DEFAULT_ROOT_FOLDER,
  monthNamingStyle: DEFAULT_MONTH_STYLE,
  requestDelaySeconds: DEFAULT_DELAY_SECONDS,
  conflictAction: CONFLICT_ACTIONS.UNIQUIFY,
  skipExisting: false,
  outputMode: 'month',
  lastYear: 1403,
  lastMonth: 1,
  lastStartDay: 1,
  lastEndDay: 30,
  lastFromYear: 1403,
  lastFromMonth: 1,
  lastFromDay: 1,
  lastToYear: 1403,
  lastToMonth: 1,
  lastToDay: 30
};

const STORAGE_KEYS = {
  SETTINGS: 'pwkara_settings',
  HISTORY: 'pwkara_history',
  ACTIVE_JOB: 'pwkara_active_job'
};

// Memory fallback for unit tests or non-extension environments
const memoryStorage = new Map();

/**
 * Checks if chrome.storage.local is available.
 */
function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

/**
 * Low-level storage getter.
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getStorageItem(key) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }
  return memoryStorage.get(key);
}

/**
 * Low-level storage setter.
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setStorageItem(key, value) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }
  memoryStorage.set(key, value);
}

/**
 * Low-level storage remover.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function removeStorageItem(key) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  }
  memoryStorage.delete(key);
}

/**
 * Loads user settings, merged with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function loadSettings() {
  const stored = await getStorageItem(STORAGE_KEYS.SETTINGS);
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * Saves user settings.
 * @param {Partial<typeof DEFAULT_SETTINGS>} updates
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function saveSettings(updates) {
  const current = await loadSettings();
  const next = { ...current, ...updates };
  await setStorageItem(STORAGE_KEYS.SETTINGS, next);
  return next;
}

/**
 * Resets user settings to defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function resetSettingsToDefaults() {
  const defaults = { ...DEFAULT_SETTINGS };
  await setStorageItem(STORAGE_KEYS.SETTINGS, defaults);
  return defaults;
}

/**
 * Loads export history records.
 * @returns {Promise<Array<Object>>}
 */
export async function loadHistory() {
  const history = await getStorageItem(STORAGE_KEYS.HISTORY);
  return Array.isArray(history) ? history : [];
}

/**
 * Adds an export job record to history (keeps max 50 recent jobs).
 * Never saves tokens or file content.
 * @param {Object} jobRecord
 * @returns {Promise<Array<Object>>}
 */
export async function addHistoryRecord(jobRecord) {
  const history = await loadHistory();
  const safeRecord = {
    id: jobRecord.id || `job_${Date.now()}`,
    startTime: jobRecord.startTime || new Date().toISOString(),
    endTime: jobRecord.endTime || new Date().toISOString(),
    year: jobRecord.year,
    month: jobRecord.month,
    startDay: jobRecord.startDay,
    endDay: jobRecord.endDay,
    totalReports: jobRecord.totalReports || 0,
    successfulDownloads: jobRecord.successfulDownloads || 0,
    failedDownloads: jobRecord.failedDownloads || 0,
    status: jobRecord.status || 'completed', // 'completed' | 'stopped' | 'failed'
    days: (jobRecord.days || []).map(d => ({
      date: d.date,
      status: d.status, // 'success' | 'failed' | 'skipped'
      filename: d.filename,
      error: d.error || null
    }))
  };

  // Prepend to show latest first
  history.unshift(safeRecord);
  const trimmed = history.slice(0, 50);
  await setStorageItem(STORAGE_KEYS.HISTORY, trimmed);
  return trimmed;
}

/**
 * Clears all export history.
 * @returns {Promise<void>}
 */
export async function clearHistory() {
  await setStorageItem(STORAGE_KEYS.HISTORY, []);
}

/**
 * Saves the active job state (for recovering across popup reopenings or crashes).
 * @param {Object|null} jobState
 * @returns {Promise<void>}
 */
export async function saveActiveJobState(jobState) {
  if (!jobState) {
    await removeStorageItem(STORAGE_KEYS.ACTIVE_JOB);
  } else {
    await setStorageItem(STORAGE_KEYS.ACTIVE_JOB, jobState);
  }
}

/**
 * Loads the active job state if one was in progress.
 * @returns {Promise<Object|null>}
 */
export async function loadActiveJobState() {
  return (await getStorageItem(STORAGE_KEYS.ACTIVE_JOB)) || null;
}
