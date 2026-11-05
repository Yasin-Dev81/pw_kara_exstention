/**
 * PwKaraWeb Excel Exporter - Form Extractor
 * Extracts dynamic form fields, anti-forgery verification tokens,
 * employee filters, and Excel export command button attributes.
 */

import { isTargetPageUrl } from './validation.js';

export const EXCEL_BUTTON_SELECTOR = 'button[data-controlindex="28"]';
export const VIEW_BUTTON_SELECTOR = 'button[data-controlindex="27"]';
export const TOKEN_FIELD_NAME = '__RequestVerificationToken';

/**
 * Finds the Excel export submit button in the document.
 * Tries the official data-controlindex="28" first, then falls back
 * to any button whose text contains 'اکسل'.
 *
 * @param {Document|Element} root
 * @returns {HTMLButtonElement|null}
 */
export function findExcelButton(root = document) {
  if (!root) return null;

  // 1. Primary selector by control index
  const btnByIndex = root.querySelector(EXCEL_BUTTON_SELECTOR);
  if (btnByIndex) return btnByIndex;

  // 2. Fallback: text search for 'اکسل'
  const buttons = Array.from(root.querySelectorAll('button'));
  const btnByText = buttons.find(b => {
    const text = (b.innerText || b.textContent || '').trim();
    return text.includes('اکسل') || text.toLowerCase().includes('excel');
  });

  return btnByText || null;
}

/**
 * Resolves button name and value parameters as expected by PwKaraWeb.
 * In ASP.NET MVC / WebForms, submit button values are only submitted when clicked.
 * Because fetch(new FormData(form)) does not include button values, we must explicitly set it.
 *
 * @param {HTMLButtonElement} button
 * @returns {{ name: string, value: string }}
 */
export function getButtonCommandParams(button) {
  if (!button) {
    return { name: 'command', value: 'ایجاد جدول اکسل' };
  }

  const name = button.getAttribute('name') || button.name || 'command';
  const rawValue = button.getAttribute('value') || button.value || (button.innerText || button.textContent || '').trim();
  const value = rawValue || 'ایجاد جدول اکسل';

  return { name, value };
}

/**
 * Finds the active report form on the page.
 * @param {Document} doc
 * @returns {HTMLFormElement|null}
 */
export function findReportForm(doc = document) {
  if (!doc) return null;
  // Look for form that contains the anti-forgery token or the excel button
  const forms = Array.from(doc.querySelectorAll('form'));
  for (const form of forms) {
    if (form.querySelector(`input[name="${TOKEN_FIELD_NAME}"]`) || findExcelButton(form)) {
      return form;
    }
  }
  // Otherwise default to the first form
  return forms[0] || null;
}

/**
 * Inspects the current page DOM to evaluate connection, page validity,
 * form status, authentication token, and Excel button availability.
 *
 * @param {Document} [doc=document]
 * @param {Location} [loc=window.location]
 * @returns {Object} Detailed diagnostic status
 */
export function inspectPage(doc = (typeof document !== 'undefined' ? document : null), loc = (typeof window !== 'undefined' ? window.location : null)) {
  if (!doc || !loc) {
    return {
      onTargetPage: false,
      formFound: false,
      excelBtnFound: false,
      tokenFound: false,
      sessionValid: false,
      btnName: '',
      btnValue: '',
      actionUrl: '',
      error: 'محیط DOM در دسترس نیست.'
    };
  }

  const currentUrl = loc.href || '';
  const onTargetPage = isTargetPageUrl(currentUrl);

  const form = findReportForm(doc);
  const formFound = Boolean(form);

  let excelBtn = null;
  let btnName = '';
  let btnValue = '';
  let tokenFound = false;
  let tokenValue = '';

  if (form) {
    excelBtn = findExcelButton(form);
    const tokenInput = form.querySelector(`input[name="${TOKEN_FIELD_NAME}"]`);
    if (tokenInput && tokenInput.value) {
      tokenFound = true;
      tokenValue = tokenInput.value;
    }
  } else {
    excelBtn = findExcelButton(doc);
  }

  const excelBtnFound = Boolean(excelBtn);
  if (excelBtn) {
    const cmd = getButtonCommandParams(excelBtn);
    btnName = cmd.name;
    btnValue = cmd.value;
  }

  // Session is deemed valid if we are on the target page, form exists, token is present,
  // and no obvious login redirection banner is present
  const isLoginPage = currentUrl.toLowerCase().includes('/account/login') ||
    doc.title.includes('ورود به سیستم') ||
    Boolean(doc.querySelector('input[type="password"]'));

  const sessionValid = formFound && tokenFound && !isLoginPage;

  let actionUrl = '';
  if (form) {
    actionUrl = form.getAttribute('action') || form.action || currentUrl;
  } else {
    actionUrl = currentUrl;
  }

  return {
    onTargetPage,
    formFound,
    excelBtnFound,
    tokenFound,
    sessionValid,
    isLoginPage,
    btnName,
    btnValue,
    actionUrl,
    tokenValue
  };
}

/**
 * Extracts all key-value entries from the form into a serializable array of [key, value] pairs.
 * @param {HTMLFormElement} form
 * @returns {Array<[string, string]>}
 */
export function extractFormEntries(form) {
  if (!form) return [];
  const formData = new FormData(form);
  const entries = [];
  for (const [k, v] of formData.entries()) {
    // Exclude file inputs or non-string values
    if (typeof v === 'string') {
      entries.push([k, v]);
    }
  }
  return entries;
}
