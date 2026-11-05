/**
 * PwKaraWeb Excel Exporter - Export Manager
 * Core export orchestration engine, state machine, pacing,
 * pause/resume/stop logic, and progress tracking.
 */

import { generateDateList, formatDashDate, formatSlashDate } from './date-manager.js';
import { generateFilename } from './filename-manager.js';
import { buildDownloadPath } from './folder-manager.js';
import { validateDelay } from './validation.js';
import {
  loadSettings,
  saveActiveJobState,
  loadActiveJobState,
  addHistoryRecord
} from './storage-manager.js';

export const EXPORT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export class ExportManager {
  /**
   * @param {Object} options
   * @param {Function} options.fetchHandler - Async fn(dayItem) => { dataUrl, size }
   * @param {Function} options.downloadHandler - Async fn({ url, filename, conflictAction }) => { downloadId }
   * @param {Function} [options.checkExistsHandler] - Async fn(filename) => boolean
   * @param {Function} [options.onProgress] - Fn(statusPayload)
   */
  constructor({
    fetchHandler,
    downloadHandler,
    checkExistsHandler = null,
    onProgress = null
  }) {
    this.fetchHandler = fetchHandler;
    this.downloadHandler = downloadHandler;
    this.checkExistsHandler = checkExistsHandler;
    this.onProgress = onProgress || (() => {});

    this.state = EXPORT_STATUS.IDLE;
    this.currentJob = null;
    this.inFlight = false;
    this._pausePromiseResolve = null;
    this._stopRequested = false;
  }

  /**
   * Returns current snapshot of export manager state.
   */
  getStatus() {
    return {
      state: this.state,
      inFlight: this.inFlight,
      job: this.currentJob ? { ...this.currentJob } : null
    };
  }

  /**
   * Emits progress update to callback and saves state to storage.
   */
  async _notifyProgress(extra = {}) {
    const payload = {
      state: this.state,
      inFlight: this.inFlight,
      job: this.currentJob ? { ...this.currentJob } : null,
      ...extra
    };

    if (this.currentJob) {
      await saveActiveJobState(this.currentJob);
    } else {
      await saveActiveJobState(null);
    }

    try {
      this.onProgress(payload);
    } catch (err) {
      console.warn('onProgress notification error:', err);
    }
  }

  /**
   * Starts a new export batch.
   *
   * @param {Object} params
   * @param {number|string} params.year - Persian year
   * @param {number|string} params.month - Persian month (1-12)
   * @param {number|string} params.startDay - Start day
   * @param {number|string} params.endDay - End day
   * @param {Object} [params.settings] - Override settings
   * @returns {Promise<Object>} Final job record
   */
  async startExport({ year, month, startDay, endDay, settings: userSettings = null }) {
    if (this.state === EXPORT_STATUS.RUNNING) {
      throw new Error('یک عملیات دریافت گزارش هم‌اکنون در حال اجرا است.');
    }

    const settings = userSettings || (await loadSettings());
    const delayCheck = validateDelay(settings.requestDelaySeconds);
    const delayMs = delayCheck.delayMs;

    const dateList = generateDateList(year, month, startDay, endDay);
    if (!dateList || dateList.length === 0) {
      throw new Error('هیچ تاریخی در بازه انتخابی وجود ندارد.');
    }

    this.state = EXPORT_STATUS.RUNNING;
    this._stopRequested = false;

    this.currentJob = {
      id: `job_${Date.now()}`,
      startTime: new Date().toISOString(),
      endTime: null,
      year: Number(year),
      month: Number(month),
      startDay: Number(startDay),
      endDay: Number(endDay),
      totalReports: dateList.length,
      successfulDownloads: 0,
      failedDownloads: 0,
      skippedDownloads: 0,
      currentIndex: 0,
      currentDate: dateList[0].slashDate,
      percent: 0,
      status: EXPORT_STATUS.RUNNING,
      statusMessage: 'شروع عملیات دریافت گزارش‌ها...',
      days: dateList.map(d => ({
        slashDate: d.slashDate,
        dashDate: d.dashDate,
        day: d.day,
        month: d.month,
        year: d.year,
        monthName: d.monthName,
        monthLatin: d.monthLatin,
        status: 'pending', // 'pending' | 'downloading' | 'success' | 'failed' | 'skipped'
        filename: null,
        downloadPath: null,
        error: null
      }))
    };

    await this._notifyProgress();

    // Main execution loop
    try {
      for (let i = 0; i < this.currentJob.days.length; i++) {
        // Check if stop was requested
        if (this._stopRequested) {
          this.state = EXPORT_STATUS.STOPPED;
          this.currentJob.status = EXPORT_STATUS.STOPPED;
          this.currentJob.statusMessage = 'عملیات توسط کاربر متوقف شد.';
          break;
        }

        // Check if paused
        if (this.state === EXPORT_STATUS.PAUSED) {
          this.currentJob.statusMessage = 'عملیات در حالت توقف موقت قرار دارد.';
          await this._notifyProgress();
          await new Promise((resolve) => {
            this._pausePromiseResolve = resolve;
          });
          if (this._stopRequested) {
            this.state = EXPORT_STATUS.STOPPED;
            this.currentJob.status = EXPORT_STATUS.STOPPED;
            this.currentJob.statusMessage = 'عملیات توسط کاربر متوقف شد.';
            break;
          }
        }

        const dayItem = this.currentJob.days[i];
        this.currentJob.currentIndex = i;
        this.currentJob.currentDate = dayItem.slashDate;
        this.currentJob.statusMessage = `در حال دریافت گزارش روز ${dayItem.slashDate}...`;
        dayItem.status = 'downloading';
        await this._notifyProgress();

        // 1. Generate filename and download path
        const filename = generateFilename({
          template: settings.filenameTemplate,
          prefix: settings.filenamePrefix,
          year: dayItem.year,
          month: dayItem.month,
          day: dayItem.day
        });

        const downloadPath = buildDownloadPath({
          filename,
          year: dayItem.year,
          month: dayItem.month,
          mode: settings.folderMode,
          rootFolder: settings.rootFolder,
          monthStyle: settings.monthNamingStyle
        });

        dayItem.filename = filename;
        dayItem.downloadPath = downloadPath;

        // 2. Check if skip existing is enabled
        if (settings.skipExisting && this.checkExistsHandler) {
          const exists = await this.checkExistsHandler(downloadPath);
          if (exists) {
            dayItem.status = 'skipped';
            this.currentJob.skippedDownloads++;
            this.currentJob.statusMessage = `فایل ${filename} از قبل وجود دارد، رد شد.`;
            this._updateProgressPercent();
            await this._notifyProgress();
            continue;
          }
        }

        // 3. Perform the fetch with inFlight guard
        this.inFlight = true;
        try {
          const fetchResult = await this.fetchHandler(dayItem);

          // 4. Perform the download
          await this.downloadHandler({
            url: fetchResult.dataUrl,
            filename: downloadPath,
            conflictAction: settings.conflictAction,
            isBlobUrl: Boolean(fetchResult.isBlobUrl)
          });

          dayItem.status = 'success';
          this.currentJob.successfulDownloads++;
          this.currentJob.statusMessage = `گزارش ${dayItem.slashDate} با موفقیت دریافت و ذخیره شد.`;
        } catch (fetchErr) {
          dayItem.status = 'failed';
          dayItem.error = fetchErr.message || 'خطای نامشخص در دریافت گزارش';
          this.currentJob.failedDownloads++;
          this.currentJob.statusMessage = `خطا در دریافت ${dayItem.slashDate}: ${dayItem.error}`;
          console.error(`Export error for ${dayItem.slashDate}:`, fetchErr);

          // If session expired, stop the whole export
          if (fetchErr.message && (fetchErr.message.includes('نشست کاربری منقضی') || fetchErr.message.includes('لاگین'))) {
            this.state = EXPORT_STATUS.FAILED;
            this.currentJob.status = EXPORT_STATUS.FAILED;
            this.currentJob.statusMessage = fetchErr.message;
            this.inFlight = false;
            break;
          }
        } finally {
          this.inFlight = false;
        }

        this._updateProgressPercent();
        await this._notifyProgress();

        // 5. Rate limiting delay before next iteration (unless last item or stopped)
        if (i < this.currentJob.days.length - 1 && !this._stopRequested) {
          await this._sleep(delayMs);
        }
      }

      // Finalize status
      if (this.state === EXPORT_STATUS.RUNNING) {
        if (this.currentJob.failedDownloads > 0 && this.currentJob.successfulDownloads === 0) {
          this.state = EXPORT_STATUS.FAILED;
          this.currentJob.status = EXPORT_STATUS.FAILED;
          this.currentJob.statusMessage = 'تمامی درخواست‌های این دوره با خطا مواجه شدند.';
        } else {
          this.state = EXPORT_STATUS.COMPLETED;
          this.currentJob.status = EXPORT_STATUS.COMPLETED;
          this.currentJob.statusMessage = `عملیات تکمیل شد. ${this.currentJob.successfulDownloads} موفق، ${this.currentJob.failedDownloads} ناموفق.`;
        }
      }
    } catch (fatalErr) {
      this.state = EXPORT_STATUS.FAILED;
      if (this.currentJob) {
        this.currentJob.status = EXPORT_STATUS.FAILED;
        this.currentJob.statusMessage = `خطای بحرانی در فرآیند استخراج: ${fatalErr.message}`;
      }
    } finally {
      this.inFlight = false;
      if (this.currentJob) {
        this.currentJob.endTime = new Date().toISOString();
        // Record to persistent history
        await addHistoryRecord(this.currentJob);
        // Clear active job in storage
        await saveActiveJobState(null);
      }
      await this._notifyProgress();
    }

    return this.currentJob;
  }

  /**
   * Pauses the export safely after any in-flight request finishes.
   */
  pauseExport() {
    if (this.state === EXPORT_STATUS.RUNNING) {
      this.state = EXPORT_STATUS.PAUSED;
      if (this.currentJob) {
        this.currentJob.status = EXPORT_STATUS.PAUSED;
        this.currentJob.statusMessage = 'عملیات در انتظار توقف موقت...';
      }
      this._notifyProgress();
    }
  }

  /**
   * Resumes a paused export.
   */
  resumeExport() {
    if (this.state === EXPORT_STATUS.PAUSED) {
      this.state = EXPORT_STATUS.RUNNING;
      if (this.currentJob) {
        this.currentJob.status = EXPORT_STATUS.RUNNING;
        this.currentJob.statusMessage = 'ادامه فرآیند دریافت گزارش‌ها...';
      }
      if (this._pausePromiseResolve) {
        this._pausePromiseResolve();
        this._pausePromiseResolve = null;
      }
      this._notifyProgress();
    }
  }

  /**
   * Stops the export cleanly. Does not abort in-flight fetch,
   * but prevents any subsequent requests.
   */
  stopExport() {
    this._stopRequested = true;
    if (this.state === EXPORT_STATUS.PAUSED && this._pausePromiseResolve) {
      this._pausePromiseResolve();
      this._pausePromiseResolve = null;
    }
    if (this.state === EXPORT_STATUS.RUNNING || this.state === EXPORT_STATUS.PAUSED) {
      this.state = EXPORT_STATUS.STOPPED;
      if (this.currentJob) {
        this.currentJob.status = EXPORT_STATUS.STOPPED;
        this.currentJob.statusMessage = 'در حال توقف عملیات...';
      }
      this._notifyProgress();
    }
  }

  _updateProgressPercent() {
    if (!this.currentJob || !this.currentJob.totalReports) return;
    const processed = this.currentJob.successfulDownloads + this.currentJob.failedDownloads + this.currentJob.skippedDownloads;
    this.currentJob.percent = Math.min(100, Math.round((processed / this.currentJob.totalReports) * 100));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
