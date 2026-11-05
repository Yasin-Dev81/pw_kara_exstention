import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportPayload,
  fetchDailyReport,
  bufferToDataUrl,
  MANDATORY_DATE_FIELDS
} from '../modules/karaweb-client.js';

test('buildExportPayload builds mandatory parameters according to rule.md', () => {
  const baseEntries = [
    ['__RequestVerificationToken', 'sec_token_xyz123'],
    ['SelectedEmployeesFiltering', '1'],
    ['SelectedReportItems1InJsonFormat', '[{"id":10,"name":"کارکرد"}]'],
    ['SelectedEmployeesEmpNoInJsonFormat', '["901","902"]'],
    ['SomeOtherFilter', 'active_value']
  ];

  const payload = buildExportPayload({
    baseFormEntries: baseEntries,
    slashDate: '1405/08/12',
    btnName: 'command',
    btnValue: 'ایجاد جدول اکسل'
  });

  // 1. Verify all four date parameters are simultaneously set to '1405/08/12'
  assert.equal(payload.get('StartDate'), '1405/08/12');
  assert.equal(payload.get('EndDate'), '1405/08/12');
  assert.equal(payload.get('MonthSelector1StartDateFormatted'), '1405/08/12');
  assert.equal(payload.get('MonthSelector1EndDateFormatted'), '1405/08/12');

  // 2. Verify anti-forgery verification token is preserved
  assert.equal(payload.get('__RequestVerificationToken'), 'sec_token_xyz123');

  // 3. Verify employee filters and report selections are preserved
  assert.equal(payload.get('SelectedEmployeesFiltering'), '1');
  assert.equal(payload.get('SelectedReportItems1InJsonFormat'), '[{"id":10,"name":"کارکرد"}]');
  assert.equal(payload.get('SelectedEmployeesEmpNoInJsonFormat'), '["901","902"]');
  assert.equal(payload.get('SomeOtherFilter'), 'active_value');

  // 4. Verify command button parameter is explicitly added
  assert.equal(payload.get('command'), 'ایجاد جدول اکسل');
});

test('fetchDailyReport sends correct POST request with credentials and headers', async () => {
  let capturedRequest = null;

  // Mock fetch implementation
  const mockFetch = async (url, options) => {
    capturedRequest = { url, options };

    // Return fake binary excel file (OLE2 header)
    const mockExcel = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 1, 2, 3, 4]);
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'application/vnd.ms-excel' : null)
      },
      arrayBuffer: async () => mockExcel.buffer
    };
  };

  const res = await fetchDailyReport({
    actionUrl: 'http://172.26.87.8:8091/KaraReports/KarkardSummary',
    baseFormEntries: [['__RequestVerificationToken', 'tok123']],
    slashDate: '1405/08/12',
    btnName: 'command',
    btnValue: 'ایجاد جدول اکسل',
    customFetch: mockFetch
  });

  // Verify fetch parameters
  assert.equal(capturedRequest.url, 'http://172.26.87.8:8091/KaraReports/KarkardSummary');
  assert.equal(capturedRequest.options.method, 'POST');
  assert.equal(capturedRequest.options.credentials, 'include');
  assert.equal(capturedRequest.options.headers['Content-Type'], 'application/x-www-form-urlencoded');

  // Verify body contains dates and token
  const bodyParams = new URLSearchParams(capturedRequest.options.body);
  assert.equal(bodyParams.get('StartDate'), '1405/08/12');
  assert.equal(bodyParams.get('EndDate'), '1405/08/12');
  assert.equal(bodyParams.get('__RequestVerificationToken'), 'tok123');
  assert.equal(bodyParams.get('command'), 'ایجاد جدول اکسل');

  // Verify output
  assert.equal(res.size, 12);
  assert.equal(res.contentType, 'application/vnd.ms-excel');
});

test('fetchDailyReport throws error if server returns HTML error or redirect', async () => {
  const mockFetchHtml = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/html; charset=utf-8' },
    arrayBuffer: async () => Buffer.from('<!DOCTYPE html><html><head><title>ورود به سیستم</title></head><body><form action="/Login">ورود به سیستم</form></body></html>')
  });

  await assert.rejects(
    async () => {
      await fetchDailyReport({
        actionUrl: 'http://172.26.87.8:8091/KaraReports/KarkardSummary',
        baseFormEntries: [],
        slashDate: '1405/08/12',
        customFetch: mockFetchHtml
      });
    },
    /نشست کاربری در سامانه منقضی شده/
  );
});

test('bufferToDataUrl creates a valid base64 data URI', () => {
  const buffer = new Uint8Array([65, 66, 67, 68]).buffer; // "ABCD"
  const dataUrl = bufferToDataUrl(buffer, 'application/vnd.ms-excel');
  assert.equal(dataUrl, 'data:application/vnd.ms-excel;base64,QUJDRA==');
});
