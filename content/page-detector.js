/**
 * PwKaraWeb Excel Exporter - Content Script (Page Detector & Runner)
 * Injected into http://172.26.87.8:8091/*
 * Detects form state, verification tokens, and executes authenticated
 * report export fetch requests in the page context with native session cookies.
 */

(() => {
  const EXCEL_BUTTON_SELECTOR = 'button[data-controlindex="28"]';
  const VIEW_BUTTON_SELECTOR = 'button[data-controlindex="27"]';
  const TOKEN_FIELD_NAME = '__RequestVerificationToken';
  const MANDATORY_DATE_FIELDS = [
    'StartDate',
    'EndDate',
    'MonthSelector1StartDateFormatted',
    'MonthSelector1EndDateFormatted'
  ];

  /**
   * Finds the Excel export submit button in the document.
   */
  function findExcelButton(root = document) {
    if (!root) return null;
    const btnByIndex = root.querySelector(EXCEL_BUTTON_SELECTOR);
    if (btnByIndex) return btnByIndex;

    const buttons = Array.from(root.querySelectorAll('button'));
    return buttons.find(b => {
      const text = (b.innerText || b.textContent || '').trim();
      return text.includes('اکسل') || text.toLowerCase().includes('excel');
    }) || null;
  }

  /**
   * Resolves command button name and value.
   */
  function getButtonCommandParams(button) {
    if (!button) {
      return { name: 'command', value: 'ایجاد جدول اکسل' };
    }
    const name = button.getAttribute('name') || button.name || 'command';
    const rawVal = button.getAttribute('value') || button.value || (button.innerText || button.textContent || '').trim();
    const value = rawVal || 'ایجاد جدول اکسل';
    return { name, value };
  }

  /**
   * Finds the active report form.
   */
  function findReportForm(doc = document) {
    if (!doc) return null;
    const forms = Array.from(doc.querySelectorAll('form'));
    for (const form of forms) {
      if (form.querySelector(`input[name="${TOKEN_FIELD_NAME}"]`) || findExcelButton(form)) {
        return form;
      }
    }
    return forms[0] || null;
  }

  /**
   * Inspects page status.
   */
  function inspectPage() {
    const url = window.location.href || '';
    const isTargetPage = url.toLowerCase().includes('/karareports/karkardsummary');
    const form = findReportForm(document);
    const formFound = Boolean(form);

    let excelBtn = null;
    let btnName = '';
    let btnValue = '';
    let tokenFound = false;

    if (form) {
      excelBtn = findExcelButton(form);
      const tokenInput = form.querySelector(`input[name="${TOKEN_FIELD_NAME}"]`);
      if (tokenInput && tokenInput.value) {
        tokenFound = true;
      }
    } else {
      excelBtn = findExcelButton(document);
    }

    const excelBtnFound = Boolean(excelBtn);
    if (excelBtn) {
      const cmd = getButtonCommandParams(excelBtn);
      btnName = cmd.name;
      btnValue = cmd.value;
    }

    const isLoginPage = url.toLowerCase().includes('/account/login') ||
      document.title.includes('ورود به سیستم') ||
      Boolean(document.querySelector('input[type="password"]'));

    const sessionValid = formFound && tokenFound && !isLoginPage;

    let actionUrl = '';
    if (form) {
      actionUrl = form.getAttribute('action') || form.action || url;
    } else {
      actionUrl = url;
    }

    // Resolve relative action URL to absolute
    try {
      actionUrl = new URL(actionUrl, window.location.href).href;
    } catch {
      actionUrl = url;
    }

    return {
      onTargetPage: isTargetPage,
      formFound,
      excelBtnFound,
      tokenFound,
      sessionValid,
      isLoginPage,
      btnName,
      btnValue,
      actionUrl,
      title: document.title
    };
  }

  /**
   * Validates if binary response is an actual Excel file vs HTML error.
   */
  function validateResponse(buffer, contentType = '') {
    if (!buffer || buffer.byteLength === 0) {
      return { valid: false, error: 'پاسخ دریافتی از سرور خالی (0 بایت) است.' };
    }

    const ct = (contentType || '').toLowerCase();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const preview = decoder.decode(buffer.slice(0, 500)).trim().toLowerCase();

    if (ct.includes('text/html') || preview.startsWith('<!doctype html') || preview.startsWith('<html')) {
      if (preview.includes('login') || preview.includes('ورود') || preview.includes('کلمه عبور')) {
        return {
          valid: false,
          error: 'نشست کاربری منقضی شده و صفحه ورود بازگردانده شد. لطفاً در سامانه لاگین کنید.'
        };
      }
      return {
        valid: false,
        error: 'سرور به جای فایل اکسل، صفحه خطا یا HTML بازگرداند.'
      };
    }

    return { valid: true };
  }

  /**
   * Converts ArrayBuffer to Base64 data URL.
   */
  function bufferToDataUrl(buffer, mimeType = 'application/vnd.ms-excel') {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  }

  /**
   * Executes a single day export fetch using live DOM form data and session cookies.
   */
  async function executeDayFetch({ slashDate, actionUrl: targetUrl, btnName, btnValue }) {
    const form = findReportForm(document);
    if (!form) {
      throw new Error('فرم گزارش کارکرد در صفحه یافت نشد. لطفاً صفحه را بارگذاری مجدد نمایید.');
    }

    const excelBtn = findExcelButton(form);
    const resolvedBtn = getButtonCommandParams(excelBtn);
    const effectiveBtnName = btnName || resolvedBtn.name || 'command';
    const effectiveBtnValue = btnValue || resolvedBtn.value || 'ایجاد جدول اکسل';

    // 1. Build FormData from current live form (preserving filters, tokens, selections)
    const formData = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string' && key !== effectiveBtnName && !MANDATORY_DATE_FIELDS.includes(key)) {
        params.append(key, value);
      }
    }

    // 2. Set the Excel command button
    params.set(effectiveBtnName, effectiveBtnValue);

    // 3. Update all 4 mandatory date parameters simultaneously
    for (const field of MANDATORY_DATE_FIELDS) {
      params.set(field, slashDate);
    }

    // 4. Resolve destination action URL
    let submitUrl = targetUrl || form.getAttribute('action') || form.action || window.location.href;
    try {
      submitUrl = new URL(submitUrl, window.location.href).href;
    } catch {
      submitUrl = window.location.href;
    }

    // 5. Send POST request with native credentials
    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: params.toString(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`خطای سرور (${response.status} ${response.statusText || 'HTTP Error'}) در دریافت روز ${slashDate}`);
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.ms-excel';
    const buffer = await response.arrayBuffer();

    // 6. Validate response is not HTML login/error
    const validation = validateResponse(buffer, contentType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 7. Convert to Base64 data URL
    const dataUrl = bufferToDataUrl(buffer, contentType);

    return {
      success: true,
      dataUrl,
      size: buffer.byteLength,
      contentType
    };
  }

  // Chrome Message Listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return false;

    if (message.action === 'PING') {
      sendResponse({ status: 'ok', time: Date.now() });
      return false;
    }

    if (message.action === 'INSPECT_PAGE') {
      try {
        const diagnostics = inspectPage();
        sendResponse({ success: true, diagnostics });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false;
    }

    if (message.action === 'FETCH_SINGLE_DAY') {
      executeDayFetch(message.payload)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    }

    return false;
  });

  // Log injection readiness
  console.log('[PwKaraWeb Exporter] Content script active on', window.location.href);
})();
