import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateDelay,
  isTargetPageUrl,
  validateExcelResponse,
  MIN_DELAY_SECONDS,
  DEFAULT_DELAY_SECONDS
} from '../modules/validation.js';

test('validateDelay enforces minimum 2.0s delay rule', () => {
  // Valid default 2.5s
  const dDefault = validateDelay(2.5);
  assert.equal(dDefault.valid, true);
  assert.equal(dDefault.delayMs, 2500);

  // Valid 2.0s minimum boundary
  const dMin = validateDelay(2.0);
  assert.equal(dMin.valid, true);
  assert.equal(dMin.delayMs, 2000);

  // Valid higher delay (e.g. 5s)
  const dHigh = validateDelay(5.0);
  assert.equal(dHigh.valid, true);
  assert.equal(dHigh.delayMs, 5000);

  // Invalid: delay < 2.0s must be rejected
  const dTooFast = validateDelay(1.5);
  assert.equal(dTooFast.valid, false);
  assert.match(dTooFast.error, /حداقل زمان تأخیر مجاز (?:۲|2) ثانیه است/);

  // Invalid non-number
  const dNan = validateDelay('invalid');
  assert.equal(dNan.valid, false);
});

test('isTargetPageUrl identifies PwKaraWeb reporting URL', () => {
  assert.equal(isTargetPageUrl('http://172.26.87.8:8091/KaraReports/KarkardSummary'), true);
  assert.equal(isTargetPageUrl('http://172.26.87.8:8091/KaraReports/KarkardSummary?param=1'), true);
  assert.equal(isTargetPageUrl('http://172.26.87.8:8091/Account/Login'), false);
  assert.equal(isTargetPageUrl('https://google.com'), false);
  assert.equal(isTargetPageUrl(''), false);
});

test('validateExcelResponse validates binary excel and detects HTML login errors', () => {
  // 1. Valid OLE2 Excel binary format (starts with D0 CF 11 E0 A1 B1 1A E1)
  const ole2Header = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0]);
  const ole2Res = validateExcelResponse(ole2Header.buffer, 'application/vnd.ms-excel');
  assert.equal(ole2Res.valid, true);

  // 2. Valid OOXML / ZIP format (starts with PK\x03\x04)
  const zipHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]);
  const zipRes = validateExcelResponse(zipHeader.buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(zipRes.valid, true);

  // 3. HTML login redirect page disguised or returned with text/html
  const htmlContent = Buffer.from('<!DOCTYPE html><html><head><title>ورود به سیستم</title></head><body><form action="/Account/Login"></form></body></html>');
  const htmlRes = validateExcelResponse(htmlContent, 'text/html');
  assert.equal(htmlRes.valid, false);
  assert.match(htmlRes.error, /نشست کاربری در سامانه منقضی شده/);

  // 4. HTML error page with text/html
  const errorHtml = Buffer.from('<html><body>Server Error 500</body></html>');
  const errorRes = validateExcelResponse(errorHtml.buffer, 'text/html');
  assert.equal(errorRes.valid, false);
  assert.match(errorRes.error, /صفحه وب HTML بازگرداند/);

  // 5. Empty response buffer
  const emptyRes = validateExcelResponse(new ArrayBuffer(0), 'application/vnd.ms-excel');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.error, /خالی/);
});
