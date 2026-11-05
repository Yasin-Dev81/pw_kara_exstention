/**
 * PwKaraWeb Excel Exporter - KaraWeb Client
 * Responsible for building the URL-encoded payload, updating all 4 date fields simultaneously,
 * executing the POST fetch with credentials included, and validating response content.
 */

import { validateExcelResponse } from './validation.js';

export const MANDATORY_DATE_FIELDS = [
  'StartDate',
  'EndDate',
  'MonthSelector1StartDateFormatted',
  'MonthSelector1EndDateFormatted'
];

/**
 * Builds the URLSearchParams payload for a single day export.
 *
 * @param {Object} options
 * @param {Array<[string, string]>} options.baseFormEntries - Extracted from active form
 * @param {string} options.slashDate - Persian date in YYYY/MM/DD format (e.g., "1405/08/12")
 * @param {string} options.btnName - Command button name (e.g., "command")
 * @param {string} options.btnValue - Command button value (e.g., "ایجاد جدول اکسل")
 * @returns {URLSearchParams}
 */
export function buildExportPayload({
  baseFormEntries = [],
  slashDate,
  btnName = 'command',
  btnValue = 'ایجاد جدول اکسل'
}) {
  if (!slashDate) {
    throw new Error('تاریخ روز مشخص نشده است.');
  }

  const params = new URLSearchParams();

  // 1. Append all active form entries (filters, verification token, employee selection, etc.)
  for (const [key, value] of baseFormEntries) {
    // Avoid double setting command or date fields from base form
    if (key !== btnName && !MANDATORY_DATE_FIELDS.includes(key)) {
      params.append(key, value);
    }
  }

  // 2. Explicitly set the Excel button command parameter
  params.set(btnName, btnValue);

  // 3. Update all 4 mandatory date parameters simultaneously to the same single day
  for (const dateField of MANDATORY_DATE_FIELDS) {
    params.set(dateField, slashDate);
  }

  return params;
}

/**
 * Executes a single-day Excel export POST request against PwKaraWeb.
 *
 * @param {Object} options
 * @param {string} options.actionUrl - Form submit target URL
 * @param {Array<[string, string]>} options.baseFormEntries - Form fields
 * @param {string} options.slashDate - "YYYY/MM/DD"
 * @param {string} options.btnName
 * @param {string} options.btnValue
 * @param {Function} [options.customFetch] - Optional fetch injection for testing/mocking
 * @returns {Promise<{ buffer: ArrayBuffer, contentType: string, size: number }>}
 */
export async function fetchDailyReport({
  actionUrl,
  baseFormEntries,
  slashDate,
  btnName = 'command',
  btnValue = 'ایجاد جدول اکسل',
  customFetch = (typeof fetch !== 'undefined' ? fetch : null)
}) {
  if (!customFetch) {
    throw new Error('تابع fetch در این محیط موجود نیست.');
  }

  if (!actionUrl) {
    throw new Error('آدرس فرم مقصد (Action URL) مشخص نیست.');
  }

  const payload = buildExportPayload({
    baseFormEntries,
    slashDate,
    btnName,
    btnValue
  });

  const response = await customFetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: payload.toString(),
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`خطای سرور در دریافت گزارش ${slashDate}: کد وضعیت ${response.status} (${response.statusText || 'خطای HTTP'})`);
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = await response.arrayBuffer();

  // Validate that response is actually a binary Excel report and not an HTML login/error page
  const validation = validateExcelResponse(buffer, contentType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return {
    buffer,
    contentType: contentType || 'application/vnd.ms-excel',
    size: buffer.byteLength
  };
}

/**
 * Converts an ArrayBuffer to a Base64 data URL.
 * Allows safe, leak-free transfer between content script, background, and chrome.downloads.
 *
 * @param {ArrayBuffer} buffer
 * @param {string} mimeType
 * @returns {string} Data URL string
 */
export function bufferToDataUrl(buffer, mimeType = 'application/vnd.ms-excel') {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192; // Process in chunks to prevent call stack overflow on large buffers

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }

  const base64 = (typeof btoa !== 'undefined')
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');

  return `data:${mimeType};base64,${base64}`;
}
