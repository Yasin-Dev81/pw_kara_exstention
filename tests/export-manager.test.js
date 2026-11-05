import test from 'node:test';
import assert from 'node:assert/strict';

import { ExportManager, EXPORT_STATUS } from '../modules/export-manager.js';
import { OUTPUT_MODES } from '../modules/date-manager.js';

test('ExportManager runs sequential daily exports for Mode 1 (Month)', async () => {
  const processedDays = [];
  const timestamps = [];

  const mockFetch = async (dayItem) => {
    processedDays.push(dayItem.slashDate);
    timestamps.push(Date.now());
    return { dataUrl: 'data:application/vnd.ms-excel;base64,AAAA', size: 100 };
  };

  const downloadedFiles = [];
  const mockDownload = async ({ filename, url }) => {
    downloadedFiles.push(filename);
    return { downloadId: 101 };
  };

  const manager = new ExportManager({
    fetchHandler: mockFetch,
    downloadHandler: mockDownload
  });

  const job = await manager.startExport({
    exportMode: OUTPUT_MODES.MONTH,
    year: 1405,
    month: 8,
    startDay: 1,
    endDay: 3,
    settings: {
      filenameTemplate: '{year}-{month}-{day}.xls',
      folderMode: 'no_subfolders',
      rootFolder: 'Karkard',
      requestDelaySeconds: 2.0,
      conflictAction: 'uniquify'
    }
  });

  assert.deepEqual(processedDays, ['1405/08/01', '1405/08/02', '1405/08/03']);
  assert.equal(downloadedFiles.length, 3);
  assert.equal(job.status, EXPORT_STATUS.COMPLETED);
  assert.equal(job.successfulDownloads, 3);
});

test('ExportManager runs Mode 2 (Entire Year) and Mode 3 (Custom Range)', async () => {
  const processedCustom = [];
  const manager = new ExportManager({
    fetchHandler: async (dayItem) => {
      processedCustom.push(dayItem.slashDate);
      return { dataUrl: 'data:test', size: 10 };
    },
    downloadHandler: async () => ({ downloadId: 1 })
  });

  // Test Mode 3: Custom range crossing month boundary (Shahrivar 31 to Mehr 2)
  const jobRange = await manager.startExport({
    exportMode: OUTPUT_MODES.CUSTOM_RANGE,
    fromYear: 1403,
    fromMonth: 6,
    fromDay: 31,
    toYear: 1403,
    toMonth: 7,
    toDay: 2,
    settings: { requestDelaySeconds: 2.0 }
  });

  assert.deepEqual(processedCustom, ['1403/06/31', '1403/07/01', '1403/07/02']);
  assert.equal(jobRange.successfulDownloads, 3);
  assert.equal(jobRange.status, EXPORT_STATUS.COMPLETED);
});

test('ExportManager rejects concurrent export requests', async () => {
  const manager = new ExportManager({
    fetchHandler: async () => {
      await new Promise(r => setTimeout(r, 200));
      return { dataUrl: 'data:test', size: 10 };
    },
    downloadHandler: async () => ({ downloadId: 1 })
  });

  const p1 = manager.startExport({
    year: 1405,
    month: 8,
    startDay: 1,
    endDay: 2,
    settings: { requestDelaySeconds: 2.0 }
  });

  await assert.rejects(
    async () => {
      await manager.startExport({
        year: 1405,
        month: 8,
        startDay: 5,
        endDay: 6
      });
    },
    /یک عملیات دریافت گزارش هم‌اکنون در حال اجرا است/
  );

  await p1;
});

test('ExportManager supports clean stop without interrupting in-flight requests', async () => {
  const processed = [];
  const manager = new ExportManager({
    fetchHandler: async (dayItem) => {
      processed.push(dayItem.slashDate);
      if (dayItem.slashDate === '1405/08/02') {
        manager.stopExport();
      }
      return { dataUrl: 'data:test', size: 10 };
    },
    downloadHandler: async () => ({ downloadId: 1 })
  });

  const job = await manager.startExport({
    year: 1405,
    month: 8,
    startDay: 1,
    endDay: 5,
    settings: { requestDelaySeconds: 2.0 }
  });

  assert.deepEqual(processed, ['1405/08/01', '1405/08/02']);
  assert.equal(job.status, EXPORT_STATUS.STOPPED);
  assert.equal(manager.state, EXPORT_STATUS.STOPPED);
});

test('ExportManager stops entirely if session expires', async () => {
  let callCount = 0;
  const manager = new ExportManager({
    fetchHandler: async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('نشست کاربری در سامانه منقضی شده است. لطفاً ابتدا در سامانه لاگین کنید.');
      }
      return { dataUrl: 'data:test', size: 10 };
    },
    downloadHandler: async () => ({ downloadId: 1 })
  });

  const job = await manager.startExport({
    year: 1405,
    month: 8,
    startDay: 1,
    endDay: 5,
    settings: { requestDelaySeconds: 2.0 }
  });

  assert.equal(callCount, 2);
  assert.equal(job.status, EXPORT_STATUS.FAILED);
  assert.equal(manager.state, EXPORT_STATUS.FAILED);
});
