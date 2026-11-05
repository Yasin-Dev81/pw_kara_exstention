import test from 'node:test';
import assert from 'node:assert/strict';

import { ExportManager, EXPORT_STATUS } from '../modules/export-manager.js';
import { loadHistory } from '../modules/storage-manager.js';

test('ExportManager runs sequential daily exports and paces requests', async () => {
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

  const progressUpdates = [];
  const manager = new ExportManager({
    fetchHandler: mockFetch,
    downloadHandler: mockDownload,
    onProgress: (p) => progressUpdates.push(p)
  });

  const job = await manager.startExport({
    year: 1405,
    month: 8,
    startDay: 1,
    endDay: 3,
    settings: {
      filenameTemplate: '{year}-{month}-{day}.xls',
      folderMode: 'no_subfolders',
      rootFolder: 'Karkard',
      requestDelaySeconds: 2.0, // Minimum allowed
      conflictAction: 'uniquify'
    }
  });

  // Verify days were executed sequentially in correct order
  assert.deepEqual(processedDays, ['1405/08/01', '1405/08/02', '1405/08/03']);
  assert.equal(downloadedFiles.length, 3);
  assert.equal(downloadedFiles[0], 'Karkard/1405-08-01.xls');
  assert.equal(downloadedFiles[1], 'Karkard/1405-08-02.xls');
  assert.equal(downloadedFiles[2], 'Karkard/1405-08-03.xls');

  // Verify timestamps respect the 2.0s delay pacing between day 1->2 and 2->3
  const delta1 = timestamps[1] - timestamps[0];
  const delta2 = timestamps[2] - timestamps[1];
  assert.ok(delta1 >= 1950, `Delay between req 1 and 2 should be ~2000ms, got ${delta1}`);
  assert.ok(delta2 >= 1950, `Delay between req 2 and 3 should be ~2000ms, got ${delta2}`);

  // Verify final status
  assert.equal(job.status, EXPORT_STATUS.COMPLETED);
  assert.equal(job.successfulDownloads, 3);
  assert.equal(job.failedDownloads, 0);
  assert.equal(manager.state, EXPORT_STATUS.COMPLETED);
});

test('ExportManager rejects concurrent export requests', async () => {
  const manager = new ExportManager({
    fetchHandler: async () => {
      await new Promise(r => setTimeout(r, 200));
      return { dataUrl: 'data:test', size: 10 };
    },
    downloadHandler: async () => ({ downloadId: 1 })
  });

  // Start first job without awaiting immediately
  const p1 = manager.startExport({
    year: 1405,
    month: 8,
    startDay: 1,
    endDay: 2,
    settings: { requestDelaySeconds: 2.0 }
  });

  // Attempting to start a second job while first is running should throw
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
        // Trigger stop while day 2 is being processed
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

  // Day 1 and 2 finished, but days 3, 4, 5 were not requested due to stop
  assert.deepEqual(processed, ['1405/08/01', '1405/08/02']);
  assert.equal(job.status, EXPORT_STATUS.STOPPED);
  assert.equal(manager.state, EXPORT_STATUS.STOPPED);
});

test('ExportManager stops entirely if session expires', async () => {
  let callCount = 0;
  const manager = new ExportManager({
    fetchHandler: async (dayItem) => {
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

  // Must stop at day 2 error, not continue to days 3, 4, 5
  assert.equal(callCount, 2);
  assert.equal(job.status, EXPORT_STATUS.FAILED);
  assert.equal(manager.state, EXPORT_STATUS.FAILED);
});
