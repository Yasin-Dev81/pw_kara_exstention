/**
 * PwKaraWeb Excel Exporter - Popup Controller
 * Manages UI interactions, live previews, date validation,
 * background communication, and export lifecycle display.
 */

import {
  PERSIAN_MONTHS,
  isLeapYear,
  getDaysInMonth,
  validateDateRange,
  padZero,
  getCurrentPersianDate
} from './modules/date-manager.js';

import {
  PREDEFINED_TEMPLATES,
  DEFAULT_FILENAME_TEMPLATE,
  DEFAULT_PREFIX,
  previewFilename,
  validateTemplate,
  sanitizePrefix
} from './modules/filename-manager.js';

import {
  FOLDER_MODES,
  MONTH_NAMING_STYLES,
  DEFAULT_ROOT_FOLDER,
  DEFAULT_FOLDER_MODE,
  DEFAULT_MONTH_STYLE,
  buildDownloadPath
} from './modules/folder-manager.js';

import {
  loadSettings,
  saveSettings,
  resetSettingsToDefaults,
  loadHistory,
  clearHistory,
  CONFLICT_ACTIONS
} from './modules/storage-manager.js';

import { validateDelay, MIN_DELAY_SECONDS } from './modules/validation.js';
import { EXPORT_STATUS } from './modules/export-manager.js';

// DOM Element References
const elements = {
  // Tabs
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  btnRefreshStatus: document.getElementById('btn-refresh-status'),

  // Diagnostics
  statusConnection: document.getElementById('status-connection'),
  statusPage: document.getElementById('status-page'),
  statusSession: document.getElementById('status-session'),
  statusExcelBtn: document.getElementById('status-excel-btn'),
  alertBox: document.getElementById('alert-box'),
  alertMessage: document.getElementById('alert-message'),

  // Date selection
  selectYear: document.getElementById('select-year'),
  selectMonth: document.getElementById('select-month'),
  inputStartDay: document.getElementById('input-start-day'),
  inputEndDay: document.getElementById('input-end-day'),
  badgeLeapYear: document.getElementById('badge-leap-year'),
  btnSelectFullMonth: document.getElementById('btn-select-full-month'),
  dateRangeSummary: document.getElementById('date-range-summary'),

  // Export Progress
  progressCard: document.getElementById('progress-card'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  progressPercent: document.getElementById('progress-percent'),
  progressCurrentDate: document.getElementById('progress-current-date'),
  progressStatusBadge: document.getElementById('progress-status-badge'),
  metricTotal: document.getElementById('metric-total'),
  metricSuccess: document.getElementById('metric-success'),
  metricFailed: document.getElementById('metric-failed'),
  metricSkipped: document.getElementById('metric-skipped'),
  statusLogMessage: document.getElementById('status-log-message'),
  btnPauseExport: document.getElementById('btn-pause-export'),
  btnResumeExport: document.getElementById('btn-resume-export'),
  btnStopExport: document.getElementById('btn-stop-export'),
  btnStartExport: document.getElementById('btn-start-export'),

  // Filename settings
  selectPredefinedTemplate: document.getElementById('select-predefined-template'),
  inputFilenameTemplate: document.getElementById('input-filename-template'),
  inputFilenamePrefix: document.getElementById('input-filename-prefix'),
  previewFilenameOutput: document.getElementById('preview-filename-output'),

  // Folder settings
  selectFolderMode: document.getElementById('select-folder-mode'),
  inputRootFolder: document.getElementById('input-root-folder'),
  groupMonthStyle: document.getElementById('group-month-style'),
  selectMonthStyle: document.getElementById('select-month-style'),
  previewPathOutput: document.getElementById('preview-path-output'),

  // Download settings
  inputRequestDelay: document.getElementById('input-request-delay'),
  selectConflictAction: document.getElementById('select-conflict-action'),
  checkSkipExisting: document.getElementById('check-skip-existing'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnResetDefaults: document.getElementById('btn-reset-defaults'),

  // History
  historyContainer: document.getElementById('history-container'),
  historyEmpty: document.getElementById('history-empty'),
  btnClearHistory: document.getElementById('btn-clear-history')
};

let currentSettings = null;
let latestDiagnostics = null;

/**
 * Initializes the popup UI, loads preferences, populates dropdowns.
 */
async function init() {
  setupTabs();
  populateDropdowns();
  await loadAndApplySettings();
  setupEventListeners();
  updateDateLimitsAndLeap();
  updatePreviews();
  await checkPageStatus();
  await checkActiveExportStatus();
  await renderHistory();

  // Listen for broadcasted export progress updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'EXPORT_PROGRESS_UPDATE') {
      applyProgressUpdate(message.payload);
    }
  });
}

/**
 * Tab Navigation Setup
 */
function setupTabs() {
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      elements.tabButtons.forEach(b => b.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (targetTabId === 'tab-history') {
        renderHistory();
      }
    });
  });
}

/**
 * Populates months and template dropdowns.
 */
function populateDropdowns() {
  // Populate Months
  elements.selectMonth.innerHTML = '';
  PERSIAN_MONTHS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${padZero(m.id)} - ${m.name}`;
    elements.selectMonth.appendChild(opt);
  });

  // Populate Templates
  elements.selectPredefinedTemplate.innerHTML = '<option value="">-- انتخاب الگوی آماده --</option>';
  PREDEFINED_TEMPLATES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.template;
    opt.textContent = `${t.template} (نمونه: ${t.label})`;
    elements.selectPredefinedTemplate.appendChild(opt);
  });
}

/**
 * Loads stored settings and applies them to controls.
 */
async function loadAndApplySettings() {
  currentSettings = await loadSettings();

  // Date selection defaults
  const todayPersian = getCurrentPersianDate();
  elements.selectYear.value = currentSettings.lastYear || todayPersian.year || 1403;
  elements.selectMonth.value = currentSettings.lastMonth || todayPersian.month || 1;
  elements.inputStartDay.value = currentSettings.lastStartDay || 1;
  elements.inputEndDay.value = currentSettings.lastEndDay || 30;

  // Filename settings
  elements.inputFilenameTemplate.value = currentSettings.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;
  elements.inputFilenamePrefix.value = currentSettings.filenamePrefix || DEFAULT_PREFIX;

  // Match predefined template if exists
  const matchedTpl = PREDEFINED_TEMPLATES.find(t => t.template === elements.inputFilenameTemplate.value);
  if (matchedTpl) {
    elements.selectPredefinedTemplate.value = matchedTpl.template;
  }

  // Folder settings
  elements.selectFolderMode.value = currentSettings.folderMode || DEFAULT_FOLDER_MODE;
  elements.inputRootFolder.value = currentSettings.rootFolder || DEFAULT_ROOT_FOLDER;
  elements.selectMonthStyle.value = currentSettings.monthNamingStyle || DEFAULT_MONTH_STYLE;

  // Download settings
  elements.inputRequestDelay.value = currentSettings.requestDelaySeconds || 2.5;
  elements.selectConflictAction.value = currentSettings.conflictAction || CONFLICT_ACTIONS.UNIQUIFY;
  elements.checkSkipExisting.checked = Boolean(currentSettings.skipExisting);

  updateFolderModeVisibility();
}

/**
 * Registers all UI event listeners.
 */
function setupEventListeners() {
  // Status refresh
  elements.btnRefreshStatus.addEventListener('click', async () => {
    elements.btnRefreshStatus.style.transform = 'rotate(360deg)';
    await checkPageStatus();
    setTimeout(() => { elements.btnRefreshStatus.style.transform = 'none'; }, 300);
  });

  // Date controls
  elements.selectYear.addEventListener('input', () => {
    updateDateLimitsAndLeap();
    updatePreviews();
  });

  elements.selectMonth.addEventListener('change', () => {
    updateDateLimitsAndLeap();
    updatePreviews();
  });

  elements.inputStartDay.addEventListener('input', () => {
    updateDateRangeSummary();
    updatePreviews();
  });

  elements.inputEndDay.addEventListener('input', () => {
    updateDateRangeSummary();
    updatePreviews();
  });

  elements.btnSelectFullMonth.addEventListener('click', () => {
    const y = Number(elements.selectYear.value);
    const m = Number(elements.selectMonth.value);
    const maxDays = getDaysInMonth(y, m);
    elements.inputStartDay.value = 1;
    elements.inputEndDay.value = maxDays;
    updateDateRangeSummary();
    updatePreviews();
  });

  // Filename template controls
  elements.selectPredefinedTemplate.addEventListener('change', () => {
    if (elements.selectPredefinedTemplate.value) {
      elements.inputFilenameTemplate.value = elements.selectPredefinedTemplate.value;
      updatePreviews();
    }
  });

  elements.inputFilenameTemplate.addEventListener('input', () => {
    // Check if matches a predefined one
    const matched = PREDEFINED_TEMPLATES.find(t => t.template === elements.inputFilenameTemplate.value.trim());
    elements.selectPredefinedTemplate.value = matched ? matched.template : '';
    updatePreviews();
  });

  elements.inputFilenamePrefix.addEventListener('input', updatePreviews);

  // Folder controls
  elements.selectFolderMode.addEventListener('change', () => {
    updateFolderModeVisibility();
    updatePreviews();
  });

  elements.inputRootFolder.addEventListener('input', updatePreviews);
  elements.selectMonthStyle.addEventListener('change', updatePreviews);

  // Settings action buttons
  elements.btnSaveSettings.addEventListener('click', handleSaveSettings);
  elements.btnResetDefaults.addEventListener('click', handleResetDefaults);

  // Export buttons
  elements.btnStartExport.addEventListener('click', handleStartExport);
  elements.btnPauseExport.addEventListener('click', handlePauseExport);
  elements.btnResumeExport.addEventListener('click', handleResumeExport);
  elements.btnStopExport.addEventListener('click', handleStopExport);

  // History
  elements.btnClearHistory.addEventListener('click', handleClearHistory);
}

/**
 * Updates folder mode visibility (hides month style in Mode 3).
 */
function updateFolderModeVisibility() {
  const mode = elements.selectFolderMode.value;
  if (mode === FOLDER_MODES.NO_SUBFOLDERS) {
    elements.groupMonthStyle.classList.add('hidden');
  } else {
    elements.groupMonthStyle.classList.remove('hidden');
  }
}

/**
 * Computes leap year status and updates day limits for the selected month.
 */
function updateDateLimitsAndLeap() {
  const y = Number(elements.selectYear.value) || 1403;
  const m = Number(elements.selectMonth.value) || 1;

  const isLeap = isLeapYear(y);
  if (isLeap) {
    elements.badgeLeapYear.classList.remove('hidden');
    elements.badgeLeapYear.textContent = `سال ${y} کبیسه است`;
  } else {
    elements.badgeLeapYear.classList.add('hidden');
  }

  const maxDays = getDaysInMonth(y, m);
  elements.inputStartDay.max = maxDays;
  elements.inputEndDay.max = maxDays;

  // Auto-clamp if value exceeded maxDays
  if (Number(elements.inputEndDay.value) > maxDays) {
    elements.inputEndDay.value = maxDays;
  }
  if (Number(elements.inputStartDay.value) > maxDays) {
    elements.inputStartDay.value = maxDays;
  }

  updateDateRangeSummary();
}

/**
 * Updates text summary of the selected date range.
 */
function updateDateRangeSummary() {
  const y = Number(elements.selectYear.value);
  const m = Number(elements.selectMonth.value);
  const s = Number(elements.inputStartDay.value);
  const e = Number(elements.inputEndDay.value);

  const validation = validateDateRange(y, m, s, e);
  if (!validation.valid) {
    elements.dateRangeSummary.textContent = validation.error;
    elements.dateRangeSummary.style.color = '#c5221f';
  } else {
    const totalDays = (e - s) + 1;
    elements.dateRangeSummary.textContent = `${totalDays} روز کاری انتخاب شده است (از روز ${s} تا ${e})`;
    elements.dateRangeSummary.style.color = 'var(--text-muted)';
  }
}

/**
 * Updates live previews for filename and download path.
 */
function updatePreviews() {
  const y = Number(elements.selectYear.value) || 1405;
  const m = Number(elements.selectMonth.value) || 8;
  const s = Number(elements.inputStartDay.value) || 12;

  const template = elements.inputFilenameTemplate.value || DEFAULT_FILENAME_TEMPLATE;
  const prefix = elements.inputFilenamePrefix.value || DEFAULT_PREFIX;

  // Filename preview
  const previewName = previewFilename(template, prefix, y, m, s);
  elements.previewFilenameOutput.textContent = previewName;

  // Download path preview
  const folderMode = elements.selectFolderMode.value;
  const rootFolder = elements.inputRootFolder.value;
  const monthStyle = elements.selectMonthStyle.value;

  const previewPath = buildDownloadPath({
    filename: previewName,
    year: y,
    month: m,
    mode: folderMode,
    rootFolder,
    monthStyle
  });

  elements.previewPathOutput.textContent = previewPath;
}

/**
 * Inspects PwKaraWeb page status and updates diagnostics UI.
 */
async function checkPageStatus() {
  showAlert(null); // Clear previous alerts

  try {
    const response = await chrome.runtime.sendMessage({ action: 'INSPECT_STATUS' });
    if (!response || !response.success) {
      setDiagnosticBadge(elements.statusConnection, 'عدم ارتباط', 'error');
      setDiagnosticBadge(elements.statusPage, 'نامشخص', 'neutral');
      setDiagnosticBadge(elements.statusSession, 'نامشخص', 'neutral');
      setDiagnosticBadge(elements.statusExcelBtn, 'نامشخص', 'neutral');
      showAlert(response ? response.error : 'امکان برقراری ارتباط با سامانه کارا وجود ندارد.');
      elements.btnStartExport.disabled = true;
      return;
    }

    latestDiagnostics = response.diagnostics;

    // 1. Connection
    if (latestDiagnostics.connected) {
      setDiagnosticBadge(elements.statusConnection, 'متصل', 'success');
    } else {
      setDiagnosticBadge(elements.statusConnection, 'عدم اتصال', 'error');
    }

    // 2. Page Detection
    if (latestDiagnostics.onTargetPage) {
      setDiagnosticBadge(elements.statusPage, 'شناسایی شد', 'success');
    } else if (latestDiagnostics.tabFound) {
      setDiagnosticBadge(elements.statusPage, 'صفحه نامرتبط', 'warning');
      showAlert('شما در صفحه گزارش کارکرد (KarkardSummary) قرار ندارید. لطفاً به بخش گزارشات سامانه کارا مراجعه کنید.');
    } else {
      setDiagnosticBadge(elements.statusPage, 'صفحه باز نیست', 'error');
      showAlert('زبانه سامانه کارا در مرورگر یافت نشد. لطفاً ابتدا در یک زبانه به سامانه وارد شوید.');
    }

    // 3. Session & Token
    if (latestDiagnostics.sessionValid) {
      setDiagnosticBadge(elements.statusSession, 'معتبر', 'success');
    } else if (latestDiagnostics.isLoginPage) {
      setDiagnosticBadge(elements.statusSession, 'نیازمند ورود', 'error');
      showAlert('نشست کاربری شما منقضی شده یا در صفحه ورود قرار دارید. لطفاً ابتدا وارد سامانه شوید.');
    } else if (!latestDiagnostics.tokenFound) {
      setDiagnosticBadge(elements.statusSession, 'فاقد توکن', 'warning');
    } else {
      setDiagnosticBadge(elements.statusSession, 'نامعتبر', 'neutral');
    }

    // 4. Excel Export Button
    if (latestDiagnostics.excelBtnFound) {
      setDiagnosticBadge(elements.statusExcelBtn, 'یافت شد', 'success');
    } else {
      setDiagnosticBadge(elements.statusExcelBtn, 'یافت نشد', 'warning');
    }

    // Check if start export is allowed
    const canStart = latestDiagnostics.tabFound &&
      latestDiagnostics.formFound &&
      latestDiagnostics.tokenFound &&
      latestDiagnostics.excelBtnFound &&
      latestDiagnostics.sessionValid;

    elements.btnStartExport.disabled = !canStart;
  } catch (err) {
    setDiagnosticBadge(elements.statusConnection, 'خطا', 'error');
    showAlert(`خطا در بررسی وضعیت صفحه: ${err.message}`);
    elements.btnStartExport.disabled = true;
  }
}

/**
 * Checks if there is an active background export running.
 */
async function checkActiveExportStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ action: 'GET_EXPORT_STATUS' });
    if (res && res.success && res.status) {
      applyProgressUpdate(res.status);
    }
  } catch (err) {
    console.warn('Error fetching export status:', err);
  }
}

/**
 * Updates diagnostic badges with color and text.
 */
function setDiagnosticBadge(el, text, type) {
  el.textContent = text;
  el.className = 'status-badge';
  switch (type) {
    case 'success':
      el.classList.add('badge-success');
      break;
    case 'warning':
      el.classList.add('badge-warning');
      break;
    case 'error':
      el.classList.add('badge-error');
      break;
    default:
      el.classList.add('badge-neutral');
  }
}

/**
 * Shows or hides the alert box banner.
 */
function showAlert(message) {
  if (message) {
    elements.alertMessage.textContent = message;
    elements.alertBox.classList.remove('hidden');
  } else {
    elements.alertBox.classList.add('hidden');
  }
}

/**
 * Saves configuration to storage.
 */
async function handleSaveSettings() {
  const delayValidation = validateDelay(elements.inputRequestDelay.value);
  if (!delayValidation.valid) {
    alert(delayValidation.error);
    return;
  }

  const templateValidation = validateTemplate(elements.inputFilenameTemplate.value);
  if (!templateValidation.valid) {
    alert(templateValidation.error);
    return;
  }

  const updates = {
    filenameTemplate: elements.inputFilenameTemplate.value.trim(),
    filenamePrefix: sanitizePrefix(elements.inputFilenamePrefix.value),
    folderMode: elements.selectFolderMode.value,
    rootFolder: elements.inputRootFolder.value.trim(),
    monthNamingStyle: elements.selectMonthStyle.value,
    requestDelaySeconds: parseFloat(elements.inputRequestDelay.value),
    conflictAction: elements.selectConflictAction.value,
    skipExisting: elements.checkSkipExisting.checked
  };

  await saveSettings(updates);
  currentSettings = { ...currentSettings, ...updates };
  alert('تنظیمات با موفقیت ذخیره شد.');
}

/**
 * Resets configuration to default settings.
 */
async function handleResetDefaults() {
  if (confirm('آیا از بازنشانی کلیه تنظیمات به مقادیر اولیه اطمینان دارید؟')) {
    const defaults = await resetSettingsToDefaults();
    currentSettings = defaults;
    await loadAndApplySettings();
    updatePreviews();
    alert('تنظیمات به مقادیر پیش‌فرض بازگردانی شد.');
  }
}

/**
 * Triggers export batch execution.
 */
async function handleStartExport() {
  const y = Number(elements.selectYear.value);
  const m = Number(elements.selectMonth.value);
  const s = Number(elements.inputStartDay.value);
  const e = Number(elements.inputEndDay.value);

  const validation = validateDateRange(y, m, s, e);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  // Save last selected date choices
  await saveSettings({
    lastYear: y,
    lastMonth: m,
    lastStartDay: s,
    lastEndDay: e
  });

  // Prepare UI for active progress
  elements.progressCard.classList.remove('hidden');
  elements.btnStartExport.disabled = true;
  elements.btnPauseExport.classList.remove('hidden');
  elements.btnResumeExport.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'START_EXPORT',
      payload: {
        year: y,
        month: m,
        startDay: s,
        endDay: e,
        settings: currentSettings
      }
    });

    if (!response || !response.success) {
      alert(`خطا در شروع عملیات: ${response ? response.error : 'عدم دریافت پاسخ'}`);
      elements.btnStartExport.disabled = false;
    }
  } catch (err) {
    alert(`خطا در ارتباط با پس‌زمینه: ${err.message}`);
    elements.btnStartExport.disabled = false;
  }
}

/**
 * Pauses active export.
 */
async function handlePauseExport() {
  try {
    await chrome.runtime.sendMessage({ action: 'PAUSE_EXPORT' });
  } catch (err) {
    console.error('Pause failed:', err);
  }
}

/**
 * Resumes paused export.
 */
async function handleResumeExport() {
  try {
    await chrome.runtime.sendMessage({ action: 'RESUME_EXPORT' });
  } catch (err) {
    console.error('Resume failed:', err);
  }
}

/**
 * Stops active export completely.
 */
async function handleStopExport() {
  if (confirm('آیا از متوقف کردن کامل فرآیند دریافت اطمینان دارید؟')) {
    try {
      await chrome.runtime.sendMessage({ action: 'STOP_EXPORT' });
    } catch (err) {
      console.error('Stop failed:', err);
    }
  }
}

/**
 * Applies progress updates to the UI.
 */
function applyProgressUpdate(statusPayload) {
  if (!statusPayload) return;

  const state = statusPayload.state;
  const job = statusPayload.job;

  if (!job) {
    if (state === EXPORT_STATUS.IDLE) {
      elements.progressCard.classList.add('hidden');
      elements.btnStartExport.disabled = false;
    }
    return;
  }

  elements.progressCard.classList.remove('hidden');

  // Percent and bar
  const percent = job.percent || 0;
  elements.progressBarFill.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressCurrentDate.textContent = job.currentDate ? `روز در حال پردازش: ${job.currentDate}` : '';

  // Counters
  elements.metricTotal.textContent = job.totalReports || 0;
  elements.metricSuccess.textContent = job.successfulDownloads || 0;
  elements.metricFailed.textContent = job.failedDownloads || 0;
  elements.metricSkipped.textContent = job.skippedDownloads || 0;

  // Status message
  elements.statusLogMessage.textContent = job.statusMessage || '';

  // Status Badge and Action Buttons
  elements.progressStatusBadge.className = 'status-badge';

  switch (state) {
    case EXPORT_STATUS.RUNNING:
      elements.progressStatusBadge.classList.add('badge-running');
      elements.progressStatusBadge.textContent = 'در حال اجرا';
      elements.btnPauseExport.classList.remove('hidden');
      elements.btnResumeExport.classList.add('hidden');
      elements.btnStartExport.disabled = true;
      break;

    case EXPORT_STATUS.PAUSED:
      elements.progressStatusBadge.classList.add('badge-warning');
      elements.progressStatusBadge.textContent = 'متوقف موقت';
      elements.btnPauseExport.classList.add('hidden');
      elements.btnResumeExport.classList.remove('hidden');
      elements.btnStartExport.disabled = true;
      break;

    case EXPORT_STATUS.COMPLETED:
      elements.progressStatusBadge.classList.add('badge-success');
      elements.progressStatusBadge.textContent = 'تکمیل شده';
      elements.btnPauseExport.classList.add('hidden');
      elements.btnResumeExport.classList.add('hidden');
      elements.btnStartExport.disabled = false;
      renderHistory();
      break;

    case EXPORT_STATUS.STOPPED:
      elements.progressStatusBadge.classList.add('badge-neutral');
      elements.progressStatusBadge.textContent = 'متوقف شده';
      elements.btnPauseExport.classList.add('hidden');
      elements.btnResumeExport.classList.add('hidden');
      elements.btnStartExport.disabled = false;
      renderHistory();
      break;

    case EXPORT_STATUS.FAILED:
      elements.progressStatusBadge.classList.add('badge-error');
      elements.progressStatusBadge.textContent = 'خطا در عملیات';
      elements.btnPauseExport.classList.add('hidden');
      elements.btnResumeExport.classList.add('hidden');
      elements.btnStartExport.disabled = false;
      renderHistory();
      break;

    default:
      elements.btnStartExport.disabled = false;
  }
}

/**
 * Renders history records.
 */
async function renderHistory() {
  const records = await loadHistory();
  elements.historyContainer.innerHTML = '';

  if (!records || records.length === 0) {
    elements.historyEmpty.classList.remove('hidden');
    elements.historyContainer.appendChild(elements.historyEmpty);
    return;
  }

  elements.historyEmpty.classList.add('hidden');

  records.forEach((rec, idx) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const startDate = new Date(rec.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    let statusBadgeClass = 'badge-success';
    let statusText = 'تکمیل شده';
    if (rec.status === 'stopped') {
      statusBadgeClass = 'badge-neutral';
      statusText = 'متوقف شده';
    } else if (rec.status === 'failed') {
      statusBadgeClass = 'badge-error';
      statusText = 'دارای خطا';
    }

    item.innerHTML = `
      <div class="history-header">
        <strong>دوره ${rec.year}/${padZero(rec.month)} (روزهای ${rec.startDay} الی ${rec.endDay})</strong>
        <span class="status-badge ${statusBadgeClass}">${statusText}</span>
      </div>
      <div class="history-meta">
        زمان شروع: ${startDate} | تعداد کل گزارش: ${rec.totalReports}
      </div>
      <div class="history-counts">
        <span style="color:#137333;">موفق: ${rec.successfulDownloads}</span>
        <span style="color:#c5221f;">ناموفق: ${rec.failedDownloads}</span>
      </div>
      <button type="button" class="history-details-toggle" data-idx="${idx}">مشاهده جزئیات روزها ▾</button>
      <div class="history-sublist hidden" id="history-details-${idx}"></div>
    `;

    // Populate daily details
    const detailsContainer = item.querySelector(`#history-details-${idx}`);
    (rec.days || []).forEach(day => {
      const subItem = document.createElement('div');
      subItem.className = 'history-subitem';
      const dayColor = day.status === 'success' ? '#137333' : '#c5221f';
      subItem.innerHTML = `
        <span>${day.date} - ${day.filename || ''}</span>
        <span style="color:${dayColor};">${day.status === 'success' ? 'موفق' : (day.error || 'خطا')}</span>
      `;
      detailsContainer.appendChild(subItem);
    });

    const toggleBtn = item.querySelector('.history-details-toggle');
    toggleBtn.addEventListener('click', () => {
      detailsContainer.classList.toggle('hidden');
      toggleBtn.textContent = detailsContainer.classList.contains('hidden') ? 'مشاهده جزئیات روزها ▾' : 'بستن جزئیات ▴';
    });

    elements.historyContainer.appendChild(item);
  });
}

/**
 * Clears history after confirmation.
 */
async function handleClearHistory() {
  if (confirm('آیا از پاک کردن کامل تاریخچه اطمینان دارید؟')) {
    await clearHistory();
    await renderHistory();
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
