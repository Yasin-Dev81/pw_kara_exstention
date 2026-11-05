/**
 * PwKaraWeb Excel Exporter - Download Manager
 * Coordinates Chrome Downloads API requests, safe Blob URL lifecycle management,
 * and conflict handling.
 */

import { CONFLICT_ACTIONS } from './storage-manager.js';

// Map of downloadId -> { objectUrl, resolve, reject }
const activeBlobUrls = new Map();
let downloadListenerInstalled = false;

/**
 * Ensures the chrome.downloads.onChanged listener is registered
 * to safely revoke Blob Object URLs after download completion or failure.
 */
function ensureDownloadListener() {
  if (downloadListenerInstalled) return;
  if (typeof chrome === 'undefined' || !chrome.downloads || !chrome.downloads.onChanged) return;

  chrome.downloads.onChanged.addListener((delta) => {
    if (!delta || !delta.id) return;
    const tracked = activeBlobUrls.get(delta.id);
    if (!tracked) return;

    if (delta.state) {
      if (delta.state.current === 'complete') {
        cleanupTrackedBlob(delta.id);
        if (tracked.resolve) tracked.resolve({ downloadId: delta.id, state: 'complete' });
      } else if (delta.state.current === 'interrupted') {
        const errorMsg = delta.error ? delta.error.current : 'خطای نامشخص در دانلود';
        cleanupTrackedBlob(delta.id);
        if (tracked.reject) tracked.reject(new Error(`دانلود با خطا متوقف شد: ${errorMsg}`));
      }
    }
  });

  downloadListenerInstalled = true;
}

/**
 * Safely cleans up and revokes an Object URL once Chrome has consumed it.
 * @param {number} downloadId
 */
function cleanupTrackedBlob(downloadId) {
  const tracked = activeBlobUrls.get(downloadId);
  if (tracked) {
    if (tracked.objectUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try {
        URL.revokeObjectURL(tracked.objectUrl);
      } catch (err) {
        console.warn('Error revoking ObjectURL:', err);
      }
    }
    activeBlobUrls.delete(downloadId);
  }
}

/**
 * Checks if a file with the given relative path has already been downloaded in the past.
 * Used when "skipExisting" option is enabled.
 *
 * @param {string} relativePath
 * @returns {Promise<boolean>}
 */
export async function checkIfFileExists(relativePath) {
  if (typeof chrome === 'undefined' || !chrome.downloads || !chrome.downloads.search) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      // Search download history for matching filename
      chrome.downloads.search({ state: 'complete' }, (results) => {
        if (chrome.runtime.lastError || !results) {
          resolve(false);
          return;
        }

        // Normalize paths to check if any downloaded item ends with our target path
        const normalizedTarget = relativePath.replace(/\\/g, '/').toLowerCase();
        const found = results.some(item => {
          if (!item.filename) return false;
          const itemNormalized = item.filename.replace(/\\/g, '/').toLowerCase();
          return itemNormalized.endsWith(normalizedTarget) && item.exists !== false;
        });

        resolve(found);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Triggers a file download via Chrome Downloads API with safe URL lifecycle.
 *
 * @param {Object} options
 * @param {string} options.url - Data URL or Blob URL
 * @param {string} options.filename - Relative download path (e.g. "Karkard/1405/08-Aban/Karkard_1405_08_12.xls")
 * @param {string} [options.conflictAction='uniquify'] - 'uniquify' | 'overwrite' | 'prompt'
 * @param {boolean} [options.isBlobUrl=false] - If true, tracks download for safe URL revocation
 * @returns {Promise<{ downloadId: number }>}
 */
export async function downloadFile({
  url,
  filename,
  conflictAction = CONFLICT_ACTIONS.UNIQUIFY,
  isBlobUrl = false
}) {
  if (typeof chrome === 'undefined' || !chrome.downloads || !chrome.downloads.download) {
    throw new Error('Chrome Downloads API در این محیط در دسترس نیست.');
  }

  ensureDownloadListener();

  // Validate conflictAction
  const validAction = Object.values(CONFLICT_ACTIONS).includes(conflictAction)
    ? conflictAction
    : CONFLICT_ACTIONS.UNIQUIFY;

  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url,
      filename,
      conflictAction: validAction,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        if (isBlobUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }
        reject(new Error(`خطای شروع دانلود: ${chrome.runtime.lastError.message}`));
        return;
      }

      if (!downloadId) {
        if (isBlobUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }
        reject(new Error('شناسه دانلود نامعتبر است.'));
        return;
      }

      if (isBlobUrl) {
        // Track the blob URL for cleanup when download completes
        activeBlobUrls.set(downloadId, {
          objectUrl: url,
          resolve: null,
          reject: null
        });

        // Set safety fallback cleanup timer (e.g. 5 minutes)
        setTimeout(() => {
          cleanupTrackedBlob(downloadId);
        }, 5 * 60 * 1000);
      }

      resolve({ downloadId });
    });
  });
}
