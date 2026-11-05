/**
 * PwKaraWeb Excel Exporter - Folder Manager
 * Manages folder organization modes, path construction,
 * subfolder styling, and download path sanitization.
 */

import { getMonthName, getMonthLatinName, padZero } from './date-manager.js';

export const FOLDER_MODES = {
  YEAR_MONTH: 'year_month',    // Root/Year/Month/filename.xls
  MONTH_ONLY: 'month_only',    // Root/Year-Month/filename.xls
  NO_SUBFOLDERS: 'no_subfolders' // Root/filename.xls
};

export const MONTH_NAMING_STYLES = {
  NUMERIC: 'numeric',         // 08
  LATIN: 'latin',             // 08-Aban
  PERSIAN: 'persian'          // 08-آبان
};

export const DEFAULT_ROOT_FOLDER = 'Karkard';
export const DEFAULT_FOLDER_MODE = FOLDER_MODES.YEAR_MONTH;
export const DEFAULT_MONTH_STYLE = MONTH_NAMING_STYLES.LATIN;

/**
 * Characters not allowed in folder path segments.
 * Windows forbids < > : " / \ | ? * and control chars.
 */
const INVALID_FOLDER_CHARS_REGEX = /[<>:"\\|?*\x00-\x1F]/g;

/**
 * Sanitizes a single folder name segment.
 * @param {string} segment
 * @returns {string}
 */
export function sanitizeFolderSegment(segment) {
  if (!segment || typeof segment !== 'string') return '';
  let cleaned = segment.replace(INVALID_FOLDER_CHARS_REGEX, '_');
  // Disallow path traversal
  cleaned = cleaned.replace(/\.\.+/g, '');
  cleaned = cleaned.trim();
  // Strip trailing dots/spaces
  cleaned = cleaned.replace(/[. ]+$/, '');
  return cleaned;
}

/**
 * Builds the month folder name based on user style preference.
 * @param {number|string} month
 * @param {string} style - 'numeric' | 'latin' | 'persian'
 * @returns {string} e.g. "08-Aban", "08-آبان", or "08"
 */
export function formatMonthFolder(month, style = MONTH_NAMING_STYLES.LATIN) {
  const m = Number(month);
  const mStr = padZero(m);

  switch (style) {
    case MONTH_NAMING_STYLES.PERSIAN:
      return `${mStr}-${getMonthName(m)}`;
    case MONTH_NAMING_STYLES.NUMERIC:
      return mStr;
    case MONTH_NAMING_STYLES.LATIN:
    default:
      return `${mStr}-${getMonthLatinName(m)}`;
  }
}

/**
 * Generates the complete download-relative file path for Chrome Downloads API.
 * Chrome downloads paths must be relative to the user's default Downloads folder.
 * Example outputs:
 * - Mode 1: "Karkard/1405/08-Aban/Karkard_1405_08_12.xls"
 * - Mode 2: "Karkard/1405-08/Karkard_1405_08_12.xls"
 * - Mode 3: "Karkard/Karkard_1405_08_12.xls"
 *
 * @param {Object} params
 * @param {string} params.filename - Sanitized filename (e.g. "1405-08-12.xls")
 * @param {number|string} params.year - Persian year
 * @param {number|string} params.month - Persian month
 * @param {string} [params.mode=FOLDER_MODES.YEAR_MONTH]
 * @param {string} [params.rootFolder=DEFAULT_ROOT_FOLDER]
 * @param {string} [params.monthStyle=DEFAULT_MONTH_STYLE]
 * @returns {string} Clean relative path with forward slashes
 */
export function buildDownloadPath({
  filename,
  year,
  month,
  mode = DEFAULT_FOLDER_MODE,
  rootFolder = DEFAULT_ROOT_FOLDER,
  monthStyle = DEFAULT_MONTH_STYLE
}) {
  const parts = [];

  const safeRoot = sanitizeFolderSegment(rootFolder);
  if (safeRoot) {
    parts.push(safeRoot);
  }

  const yStr = String(year);
  const mStr = padZero(month);

  if (mode === FOLDER_MODES.YEAR_MONTH) {
    parts.push(sanitizeFolderSegment(yStr));
    parts.push(sanitizeFolderSegment(formatMonthFolder(month, monthStyle)));
  } else if (mode === FOLDER_MODES.MONTH_ONLY) {
    const monthFolder = formatMonthFolder(month, monthStyle);
    parts.push(sanitizeFolderSegment(`${yStr}-${monthFolder}`));
  }
  // Mode 3 (NO_SUBFOLDERS): only rootFolder

  // Add the filename
  parts.push(filename);

  // Join with forward slash for Chrome Downloads API
  return parts.filter(Boolean).join('/');
}
