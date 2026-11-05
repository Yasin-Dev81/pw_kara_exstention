/**
 * PwKaraWeb Excel Exporter - Popup Controller
 * Liquid Glass UI implementation (Glisse)
 * Supports:
 *  1. Output from a specific month of a specific year (ماه مشخص)
 *  2. Output for the entire specified year (کل سال)
 *  3. Output based on a time period between two specified dates (بازه بین دو تاریخ)
 */

import {
  OUTPUT_MODES,
  PERSIAN_MONTHS,
  isLeapYear,
  getDaysInMonth,
  getDaysInYear,
  validateDateRange,
  validateCustomDateRange,
  generateCustomRangeDateList,
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

import { validateDelay } from './modules/validation.js';
import { EXPORT_STATUS } from './modules/export-manager.js';

// DOM Elements Reference
const elements = {
  // Navigation Tabs
  tabButtons: document.querySelectorAll('#main-nav-tabs .lg-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  btnRefreshStatus: document.getElementById('btn-refresh-status'),

  // Diagnostics
  statusConnection: document.getElementById('status-connection'),
  statusPage: document.getElementById('status-page'),
  statusSession: document.getElementById('status-session'),
  statusExcelBtn: document.getElementById('status-excel-btn'),
  alertBox: document.getElementById('alert-box'),
  alertMessage: document.getElementById('alert-message'),

  // Output Mode Segmented Control
  modeTabs: document.querySelectorAll('#mode-segmented-control .lg-tab'),
  panelModeMonth: document.getElementById('panel-mode-month'),
  panelModeYear: document.getElementById('panel-mode-year'),
  panelModeRange: document.getElementById('panel-mode-range'),

  // Mode 1: Month
  selectYear: document.getElementById('select-year'),
  selectMonth: document.getElementById('select-month'),
  inputStartDay: document.getElementById('input-start-day'),
  inputEndDay: document.getElementById('input-end-day'),
  badgeLeapYear: document.getElementById('badge-leap-year'),
  btnSelectFullMonth: document.getElementById('btn-select-full-month'),
  dateRangeSummary: document.getElementById('date-range-summary'),

  // Mode 2: Year
  selectYearFull: document.getElementById('select-year-full'),
  badgeYearDays: document.getElementById('badge-year-days'),

  // Mode 3: Custom Range
  rangeFromYear: document.getElementById('range-from-year'),
  rangeFromMonth: document.getElementById('range-from-month'),
  rangeFromDay: document.getElementById('range-from-day'),
  rangeToYear: document.getElementById('range-to-year'),
  rangeToMonth: document.getElementById('range-to-month'),
  rangeToDay: document.getElementById('range-to-day'),
  rangeSummaryText: document.getElementById('range-summary-text'),

  // Export Progress Card
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
  btnStartText: document.getElementById('btn-start-text'),

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
let currentOutputMode = OUTPUT_MODES.MONTH;

/**
 * Initializes the popup controller.
 */
async function init() {
  setupTabs();
  setupModeSelector();
  populateDropdowns();
  await loadAndApplySettings();
  setupEventListeners();
  updateModeView();
  updateDateLimitsAndLeap();
  updatePreviews();
  await checkPageStatus();
  await checkActiveExportStatus();
  await renderHistory();

  // Listen for background export progress updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'EXPORT_PROGRESS_UPDATE') {
      applyProgressUpdate(message.payload);
    }
  });
}

/**
 * Sets up main navigation tabs.
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
 * Sets up the 3 Output Modes Segmented Control (Glisse style).
 */
function setupModeSelector() {
  elements.modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode');
      if (mode && Object.values(OUTPUT_MODES).includes(mode)) {
        currentOutputMode = mode;
        updateModeView();
        updatePreviews();
      }
    });
  });
}

/**
 * Updates UI view based on active Output Mode.
 */
function updateModeView() {
  // Update segmented control active states
  elements.modeTabs.forEach(tab => {
    const isSelected = tab.getAttribute('data-mode') === currentOutputMode;
    tab.classList.toggle('active', isSelected);
    tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });

  // Switch panels
  elements.panelModeMonth.classList.toggle('active', currentOutputMode === OUTPUT_MODES.MONTH);
  elements.panelModeYear.classList.toggle('active', currentOutputMode === OUTPUT_MODES.YEAR);
  elements.panelModeRange.classList.toggle('active', currentOutputMode === OUTPUT_MODES.CUSTOM_RANGE);

  // Update primary button text
  switch (currentOutputMode) {
    case OUTPUT_MODES.YEAR:
      elements.btnStartText.textContent = 'شروع دریافت گزارش‌های کل سال';
      updateYearModeInfo();
      break;
    case OUTPUT_MODES.CUSTOM_RANGE:
      elements.btnStartText.textContent = 'شروع دریافت گزارش‌های بازه انتخابی';
      updateCustomRangeSummary();
      break;
    case OUTPUT_MODES.MONTH:
    default:
      elements.btnStartText.textContent = 'شروع دریافت گزارش‌های ماه';
      updateDateLimitsAndLeap();
      break;
  }
}

/**
 * Populates dropdown options for months and predefined templates.
 */
function populateDropdowns() {
  // Populate Months for Mode 1
  elements.selectMonth.innerHTML = '';
  PERSIAN_MONTHS.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${padZero(m.id)} - ${m.name}`;
    elements.selectMonth.appendChild(opt);
  });

  // Populate Months for Mode 3 (From and To)
  elements.rangeFromMonth.innerHTML = '';
  elements.rangeToMonth.innerHTML = '';
  PERSIAN_MONTHS.forEach(m => {
    const optFrom = document.createElement('option');
    optFrom.value = m.id;
    optFrom.textContent = `${padZero(m.id)} - ${m.name}`;
    elements.rangeFromMonth.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = m.id;
    optTo.textContent = `${padZero(m.id)} - ${m.name}`;
    elements.rangeToMonth.appendChild(optTo);
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
 * Loads stored settings and initializes inputs.
 */
async function loadAndApplySettings() {
  currentSettings = await loadSettings();

  const todayPersian = getCurrentPersianDate();

  // Mode 1: Month
  elements.selectYear.value = currentSettings.lastYear || todayPersian.year || 1403;
  elements.selectMonth.value = currentSettings.lastMonth || todayPersian.month || 1;
  elements.inputStartDay.value = currentSettings.lastStartDay || 1;
  elements.inputEndDay.value = currentSettings.lastEndDay || 30;

  // Mode 2: Year
  elements.selectYearFull.value = currentSettings.lastYear || todayPersian.year || 1403;

  // Mode 3: Custom Range
  elements.rangeFromYear.value = currentSettings.lastFromYear || currentSettings.lastYear || todayPersian.year || 1403;
  elements.rangeFromMonth.value = currentSettings.lastFromMonth || currentSettings.lastMonth || 1;
  elements.rangeFromDay.value = currentSettings.lastFromDay || 1;

  elements.rangeToYear.value = currentSettings.lastToYear || currentSettings.lastYear || todayPersian.year || 1403;
  elements.rangeToMonth.value = currentSettings.lastToMonth || currentSettings.lastMonth || 1;
  elements.rangeToDay.value = currentSettings.lastToDay || 30;

  if (currentSettings.outputMode && Object.values(OUTPUT_MODES).includes(currentSettings.outputMode)) {
    currentOutputMode = currentSettings.outputMode;
  }

  // Filename settings
  elements.inputFilenameTemplate.value = currentSettings.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;
  elements.inputFilenamePrefix.value = currentSettings.filenamePrefix || DEFAULT_PREFIX;

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
 * Event listeners setup.
 */
function setupEventListeners() {
  // Status refresh
  elements.btnRefreshStatus.addEventListener('click', async () => {
    elements.btnRefreshStatus.style.transform = 'rotate(360deg)';
    await checkPageStatus();
    setTimeout(() => { elements.btnRefreshStatus.style.transform = 'none'; }, 300);
  });

  // Mode 1: Month controls
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

  // Mode 2: Full Year controls
  elements.selectYearFull.addEventListener('input', () => {
    updateYearModeInfo();
    updatePreviews();
  });

  // Mode 3: Custom Range controls
  [
    elements.rangeFromYear,
    elements.rangeFromMonth,
    elements.rangeFromDay,
    elements.rangeToYear,
    elements.rangeToMonth,
    elements.rangeToDay
  ].forEach(input => {
    input.addEventListener('input', () => {
      updateCustomRangeSummary();
      updatePreviews();
    });
    input.addEventListener('change', () => {
      updateCustomRangeSummary();
      updatePreviews();
    });
  });

  // Filename template controls
  elements.selectPredefinedTemplate.addEventListener('change', () => {
    if (elements.selectPredefinedTemplate.value) {
      elements.inputFilenameTemplate.value = elements.selectPredefinedTemplate.value;
      updatePreviews();
    }
  });

  elements.inputFilenameTemplate.addEventListener('input', () => {
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

function updateFolderModeVisibility() {
  const mode = elements.selectFolderMode.value;
  elements.groupMonthStyle.classList.toggle('hidden', mode === FOLDER_MODES.NO_SUBFOLDERS);
}

function updateDateLimitsAndLeap() {
  const y = Number(elements.selectYear.value) || 1403;
  const m = Number(elements.selectMonth.value) || 1;

  const isLeap = isLeapYear(y);
  elements.badgeLeapYear.classList.toggle('hidden', !isLeap);
  if (isLeap) {
    elements.badgeLeapYear.textContent = `سال ${y} کبیسه است`;
  }

  const maxDays = getDaysInMonth(y, m);
  elements.inputStartDay.max = maxDays;
  elements.inputEndDay.max = maxDays;

  if (Number(elements.inputEndDay.value) > maxDays) elements.inputEndDay.value = maxDays;
  if (Number(elements.inputStartDay.value) > maxDays) elements.inputStartDay.value = maxDays;

  updateDateRangeSummary();
}

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
    elements.dateRangeSummary.style.color = 'var(--lg-muted, #6c6c70)';
  }
}

function updateYearModeInfo() {
  const y = Number(elements.selectYearFull.value) || 1403;
  const days = getDaysInYear(y);
  const isLeap = isLeapYear(y);
  elements.badgeYearDays.textContent = `${days} روز کاری (${isLeap ? 'سال کبیسه' : 'سال عادی'})`;
}

function updateCustomRangeSummary() {
  const fy = Number(elements.rangeFromYear.value);
  const fm = Number(elements.rangeFromMonth.value);
  const fd = Number(elements.rangeFromDay.value);

  const ty = Number(elements.rangeToYear.value);
  const tm = Number(elements.rangeToMonth.value);
  const td = Number(elements.rangeToDay.value);

  // Clamp days to valid max
  const maxFrom = getDaysInMonth(fy, fm);
  const maxTo = getDaysInMonth(ty, tm);
  elements.rangeFromDay.max = maxFrom;
  elements.rangeToDay.max = maxTo;

  const validation = validateCustomDateRange(fy, fm, fd, ty, tm, td);
  if (!validation.valid) {
    elements.rangeSummaryText.textContent = validation.error;
    elements.rangeSummaryText.style.color = '#c5221f';
  } else {
    try {
      const dates = generateCustomRangeDateList(fy, fm, fd, ty, tm, td);
      elements.rangeSummaryText.textContent = `${dates.length} روز انتخاب شده است (از ${fy}/${padZero(fm)}/${padZero(fd)} تا ${ty}/${padZero(tm)}/${padZero(td)})`;
      elements.rangeSummaryText.style.color = '#0066cc';
    } catch (err) {
      elements.rangeSummaryText.textContent = err.message;
      elements.rangeSummaryText.style.color = '#c5221f';
    }
  }
}

/**
 * Updates live previews for filename and download path.
 */
function updatePreviews() {
  let y = 1405;
  let m = 8;
  let d = 12;

  if (currentOutputMode === OUTPUT_MODES.MONTH) {
    y = Number(elements.selectYear.value) || 1405;
    m = Number(elements.selectMonth.value) || 8;
    d = Number(elements.inputStartDay.value) || 12;
  } else if (currentOutputMode === OUTPUT_MODES.YEAR) {
    y = Number(elements.selectYearFull.value) || 1403;
    m = 1;
    d = 1;
  } else if (currentOutputMode === OUTPUT_MODES.CUSTOM_RANGE) {
    y = Number(elements.rangeFromYear.value) || 1403;
    m = Number(elements.rangeFromMonth.value) || 1;
    d = Number(elements.rangeFromDay.value) || 1;
  }

  const template = elements.inputFilenameTemplate.value || DEFAULT_FILENAME_TEMPLATE;
  const prefix = elements.inputFilenamePrefix.value || DEFAULT_PREFIX;

  const previewName = previewFilename(template, prefix, y, m, d);
  elements.previewFilenameOutput.textContent = previewName;

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
 * Diagnostic check of PwKaraWeb page status.
 */
async function checkPageStatus() {
  showAlert(null);

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
    setDiagnosticBadge(elements.statusConnection, latestDiagnostics.connected ? 'متصل' : 'عدم اتصال', latestDiagnostics.connected ? 'success' : 'error');

    // 2. Page
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

    // 4. Excel button
    setDiagnosticBadge(elements.statusExcelBtn, latestDiagnostics.excelBtnFound ? 'یافت شد' : 'یافت نشد', latestDiagnostics.excelBtnFound ? 'success' : 'warning');

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

function showAlert(message) {
  if (message) {
    elements.alertMessage.textContent = message;
    elements.alertBox.classList.remove('hidden');
  } else {
    elements.alertBox.classList.add('hidden');
  }
}

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
    skipExisting: elements.checkSkipExisting.checked,
    outputMode: currentOutputMode
  };

  await saveSettings(updates);
  currentSettings = { ...currentSettings, ...updates };
  alert('تنظیمات با موفقیت ذخیره شد.');
}

async function handleResetDefaults() {
  if (confirm('آیا از بازنشانی کلیه تنظیمات به مقادیر اولیه اطمینان دارید؟')) {
    const defaults = await resetSettingsToDefaults();
    currentSettings = defaults;
    currentOutputMode = OUTPUT_MODES.MONTH;
    await loadAndApplySettings();
    updateModeView();
    updatePreviews();
    alert('تنظیمات به مقادیر پیش‌فرض بازگردانی شد.');
  }
}

/**
 * Triggers export batch execution based on active mode.
 */
async function handleStartExport() {
  let payload = {
    exportMode: currentOutputMode,
    settings: currentSettings
  };

  if (currentOutputMode === OUTPUT_MODES.MONTH) {
    const y = Number(elements.selectYear.value);
    const m = Number(elements.selectMonth.value);
    const s = Number(elements.inputStartDay.value);
    const e = Number(elements.inputEndDay.value);

    const validation = validateDateRange(y, m, s, e);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    payload = {
      ...payload,
      year: y,
      month: m,
      startDay: s,
      endDay: e
    };

    await saveSettings({
      outputMode: currentOutputMode,
      lastYear: y,
      lastMonth: m,
      lastStartDay: s,
      lastEndDay: e
    });
  } else if (currentOutputMode === OUTPUT_MODES.YEAR) {
    const y = Number(elements.selectYearFull.value);
    if (isNaN(y) || y < 1300 || y > 1500) {
      alert('سال شمسی نامعتبر است.');
      return;
    }

    payload = {
      ...payload,
      year: y
    };

    await saveSettings({
      outputMode: currentOutputMode,
      lastYear: y
    });
  } else if (currentOutputMode === OUTPUT_MODES.CUSTOM_RANGE) {
    const fy = Number(elements.rangeFromYear.value);
    const fm = Number(elements.rangeFromMonth.value);
    const fd = Number(elements.rangeFromDay.value);

    const ty = Number(elements.rangeToYear.value);
    const tm = Number(elements.rangeToMonth.value);
    const td = Number(elements.rangeToDay.value);

    const validation = validateCustomDateRange(fy, fm, fd, ty, tm, td);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    payload = {
      ...payload,
      fromYear: fy,
      fromMonth: fm,
      fromDay: fd,
      toYear: ty,
      toMonth: tm,
      toDay: td
    };

    await saveSettings({
      outputMode: currentOutputMode,
      lastFromYear: fy,
      lastFromMonth: fm,
      lastFromDay: fd,
      lastToYear: ty,
      lastToMonth: tm,
      lastToDay: td
    });
  }

  elements.progressCard.classList.remove('hidden');
  elements.btnStartExport.disabled = true;
  elements.btnPauseExport.classList.remove('hidden');
  elements.btnResumeExport.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'START_EXPORT',
      payload
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

async function handlePauseExport() {
  try {
    await chrome.runtime.sendMessage({ action: 'PAUSE_EXPORT' });
  } catch (err) {
    console.error('Pause failed:', err);
  }
}

async function handleResumeExport() {
  try {
    await chrome.runtime.sendMessage({ action: 'RESUME_EXPORT' });
  } catch (err) {
    console.error('Resume failed:', err);
  }
}

async function handleStopExport() {
  if (confirm('آیا از متوقف کردن کامل فرآیند دریافت اطمینان دارید؟')) {
    try {
      await chrome.runtime.sendMessage({ action: 'STOP_EXPORT' });
    } catch (err) {
      console.error('Stop failed:', err);
    }
  }
}

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

  const percent = job.percent || 0;
  elements.progressBarFill.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressCurrentDate.textContent = job.currentDate ? `روز در حال پردازش: ${job.currentDate}` : '';

  elements.metricTotal.textContent = job.totalReports || 0;
  elements.metricSuccess.textContent = job.successfulDownloads || 0;
  elements.metricFailed.textContent = job.failedDownloads || 0;
  elements.metricSkipped.textContent = job.skippedDownloads || 0;

  elements.statusLogMessage.textContent = job.statusMessage || '';
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
    item.className = 'history-item lg-glass';

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

    const titleText = rec.summary || `دوره ${rec.year}/${padZero(rec.month)} (روزهای ${rec.startDay} الی ${rec.endDay})`;

    item.innerHTML = `
      <div class="history-header">
        <strong>${titleText}</strong>
        <span class="status-badge ${statusBadgeClass}">${statusText}</span>
      </div>
      <div class="history-meta">
        زمان شروع: ${startDate} | تعداد کل گزارش: ${rec.totalReports}
      </div>
      <div class="history-counts">
        <span style="color:#1b7a37;">موفق: ${rec.successfulDownloads}</span>
        <span style="color:#c5221f;">ناموفق: ${rec.failedDownloads}</span>
      </div>
      <button type="button" class="history-details-toggle" data-idx="${idx}">مشاهده جزئیات روزها ▾</button>
      <div class="history-sublist hidden" id="history-details-${idx}"></div>
    `;

    const detailsContainer = item.querySelector(`#history-details-${idx}`);
    (rec.days || []).forEach(day => {
      const subItem = document.createElement('div');
      subItem.className = 'history-subitem';
      const dayColor = day.status === 'success' ? '#1b7a37' : '#c5221f';
      subItem.innerHTML = `
        <span>${day.date || day.slashDate} - ${day.filename || ''}</span>
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

async function handleClearHistory() {
  if (confirm('آیا از پاک کردن کامل تاریخچه اطمینان دارید؟')) {
    await clearHistory();
    await renderHistory();
  }
}

document.addEventListener('DOMContentLoaded', init);
