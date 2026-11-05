/**
 * PwKaraWeb Excel Exporter - Validation Module
 * Centralized validation rules for inputs, configuration,
 * endpoints, and response payloads.
 */

import { validateDateRange } from './date-manager.js';
import { validateTemplate } from './filename-manager.js';

export const MIN_DELAY_SECONDS = 2.0;
export const DEFAULT_DELAY_SECONDS = 2.5;
export const MAX_DELAY_SECONDS = 60.0;

export const TARGET_HOSTNAME = '172.26.87.8:8091';
export const TARGET_PATH = '/KaraReports/KarkardSummary';

/**
 * Validates request delay setting.
 * @param {number|string} delaySec
 * @returns {{ valid: boolean, delayMs: number, error?: string }}
 */
export function validateDelay(delaySec) {
  const num = Number(delaySec);
  if (isNaN(num)) {
    return {
      valid: false,
      delayMs: DEFAULT_DELAY_SECONDS * 1000,
      error: 'مقدار تأخیر نامعتبر است.'
    };
  }

  if (num < MIN_DELAY_SECONDS) {
    return {
      valid: false,
      delayMs: MIN_DELAY_SECONDS * 1000,
      error: `حداقل زمان تأخیر مجاز ${MIN_DELAY_SECONDS} ثانیه است (جهت جلوگیری از فشار به سرور و قطع نشست).`
    };
  }

  if (num > MAX_DELAY_SECONDS) {
    return {
      valid: false,
      delayMs: MAX_DELAY_SECONDS * 1000,
      error: `حداکثر زمان تأخیر مجاز ${MAX_DELAY_SECONDS} ثانیه است.`
    };
  }

  return { valid: true, delayMs: Math.round(num * 1000) };
}

/**
 * Validates if a URL is the target PwKaraWeb reporting page.
 * @param {string} url
 * @returns {boolean}
 */
export function isTargetPageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const hostMatch = parsed.host === TARGET_HOSTNAME || parsed.hostname === '172.26.87.8';
    const pathMatch = parsed.pathname.toLowerCase().includes('/karareports/karkardsummary');
    return hostMatch && pathMatch;
  } catch {
    return false;
  }
}

/**
 * Inspects a binary response / blob / buffer to verify it is a valid Excel file
 * and NOT an HTML login redirect, error page, or empty response.
 *
 * @param {ArrayBuffer|Uint8Array|Buffer} inputBuffer
 * @param {string} contentType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateExcelResponse(inputBuffer, contentType = '') {
  if (!inputBuffer) {
    return { valid: false, error: 'پاسخ دریافتی از سرور خالی (0 بایت) است.' };
  }

  // Normalize to Uint8Array safely handling Node Buffer pool offsets and browser ArrayBuffers
  let bytes;
  if (inputBuffer instanceof Uint8Array) {
    bytes = inputBuffer;
  } else if (inputBuffer.buffer && typeof inputBuffer.byteOffset === 'number') {
    bytes = new Uint8Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.byteLength);
  } else if (inputBuffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(inputBuffer);
  } else {
    bytes = new Uint8Array(0);
  }

  if (bytes.length === 0) {
    return {
      valid: false,
      error: 'پاسخ دریافتی از سرور خالی (0 بایت) است.'
    };
  }

  const ct = (contentType || '').toLowerCase();
  const textPreview = readBytesPreview(bytes, 1024).trim().toLowerCase();

  // If content type explicitly says text/html, it is almost certainly a login redirect or error
  if (ct.includes('text/html')) {
    if (/login|ورود|نام کاربری|کلمه عبور/i.test(textPreview)) {
      return {
        valid: false,
        error: 'نشست کاربری در سامانه منقضی شده و صفحه ورود بازگردانده شد. لطفاً ابتدا در سامانه لاگین کنید.'
      };
    }
    return {
      valid: false,
      error: 'سرور به جای فایل اکسل، صفحه وب HTML بازگرداند.'
    };
  }

  // Check magic bytes / content signature
  // OLE2 Compound Document Header (Legacy Excel .xls binary format):
  // D0 CF 11 E0 A1 B1 1A E1
  const isOle2 = bytes.length >= 8 &&
    bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0 &&
    bytes[4] === 0xA1 && bytes[5] === 0xB1 && bytes[6] === 0x1A && bytes[7] === 0xE1;

  // Modern ZIP / OOXML (.xlsx) header: PK\x03\x04 (50 4B 03 04)
  const isZip = bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;

  // HTML / XML check: Check if text starts with <html or <!doctype
  if (textPreview.startsWith('<!doctype html') || textPreview.startsWith('<html') || textPreview.includes('<head>') || textPreview.includes('<body')) {
    if (textPreview.includes('login') || textPreview.includes('ورود')) {
      return {
        valid: false,
        error: 'نشست کاربری در سامانه منقضی شده است. لطفاً مجدداً وارد سامانه شوید.'
      };
    }
    return {
      valid: false,
      error: 'محتوای دریافتی به جای اکسل، کد HTML است (احتمالاً خطای سرور یا انقضای جلسه).'
    };
  }

  // XML Spreadsheet 2003 format (starts with <?xml or <Workbook):
  const isXmlSpreadsheet = textPreview.startsWith('<?xml') && (textPreview.includes('workbook') || textPreview.includes('urn:schemas-microsoft-com:office:spreadsheet'));

  // If it matches OLE2, ZIP, XML spreadsheet, or octet-stream/excel content-type:
  if (isOle2 || isZip || isXmlSpreadsheet) {
    return { valid: true };
  }

  // If content-type is an excel/binary type and it does not start with html:
  if (ct.includes('excel') || ct.includes('spreadsheet') || ct.includes('octet-stream')) {
    return { valid: true };
  }

  // Minimum safety pass if not HTML
  return { valid: true };
}

/**
 * Helper to convert Uint8Array slice to a string for inspection.
 * @param {Uint8Array} bytes
 * @param {number} maxBytes
 * @returns {string}
 */
function readBytesPreview(bytes, maxBytes = 1024) {
  try {
    const slice = bytes.subarray(0, Math.min(bytes.length, maxBytes));
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(slice);
  } catch {
    return '';
  }
}

export { validateDateRange, validateTemplate };
