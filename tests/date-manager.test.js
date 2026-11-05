import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLeapYear,
  getDaysInMonth,
  validateDateRange,
  generateDateList,
  formatSlashDate,
  formatDashDate,
  getMonthName,
  getMonthLatinName,
  PERSIAN_MONTHS
} from '../modules/date-manager.js';

test('isLeapYear accurately identifies Persian leap years', () => {
  // Known historical and future Persian leap years
  assert.equal(isLeapYear(1395), true);
  assert.equal(isLeapYear(1396), false);
  assert.equal(isLeapYear(1397), false);
  assert.equal(isLeapYear(1398), false);
  assert.equal(isLeapYear(1399), true);
  assert.equal(isLeapYear(1400), false);
  assert.equal(isLeapYear(1401), false);
  assert.equal(isLeapYear(1402), false);
  assert.equal(isLeapYear(1403), true); // 1403 is leap
  assert.equal(isLeapYear(1404), false);
  assert.equal(isLeapYear(1405), false);
  assert.equal(isLeapYear(1406), false);
  assert.equal(isLeapYear(1407), false);
  assert.equal(isLeapYear(1408), true); // 5-year leap step in Birashk cycle
  assert.equal(isLeapYear(1412), true);
});

test('getDaysInMonth validates month lengths properly', () => {
  // Months 1-6 have 31 days
  for (let m = 1; m <= 6; m++) {
    assert.equal(getDaysInMonth(1403, m), 31, `Month ${m} must have 31 days`);
    assert.equal(getDaysInMonth(1404, m), 31, `Month ${m} must have 31 days`);
  }

  // Months 7-11 have 30 days
  for (let m = 7; m <= 11; m++) {
    assert.equal(getDaysInMonth(1403, m), 30, `Month ${m} must have 30 days`);
    assert.equal(getDaysInMonth(1404, m), 30, `Month ${m} must have 30 days`);
  }

  // Month 12: 30 days in leap year 1403, 29 in non-leap 1404
  assert.equal(getDaysInMonth(1403, 12), 30);
  assert.equal(getDaysInMonth(1404, 12), 29);

  // Invalid month throws
  assert.throws(() => getDaysInMonth(1403, 0));
  assert.throws(() => getDaysInMonth(1403, 13));
});

test('validateDateRange validates dates correctly', () => {
  // Valid ranges
  assert.equal(validateDateRange(1403, 1, 1, 31).valid, true);
  assert.equal(validateDateRange(1403, 7, 1, 30).valid, true);
  assert.equal(validateDateRange(1403, 12, 1, 30).valid, true); // 1403 is leap
  assert.equal(validateDateRange(1404, 12, 1, 29).valid, true); // 1404 non-leap

  // Invalid: start > end
  const res1 = validateDateRange(1403, 1, 20, 10);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /شروع نمی‌تواند بعد از روز پایان/);

  // Invalid: end day exceeds month length
  const res2 = validateDateRange(1404, 12, 1, 30); // 1404 has only 29 days in Esfand
  assert.equal(res2.valid, false);
  assert.match(res2.error, /(?:۲۹|29) روز است/);

  // Invalid: month out of bounds
  assert.equal(validateDateRange(1403, 13, 1, 10).valid, false);

  // Invalid: negative or 0 start day
  assert.equal(validateDateRange(1403, 1, 0, 10).valid, false);
});

test('generateDateList generates distinct formatted days without duplicates', () => {
  const days = generateDateList(1405, 8, 1, 30);
  assert.equal(days.length, 30);

  // Verify uniqueness of generated dates
  const uniqueSlashes = new Set(days.map(d => d.slashDate));
  assert.equal(uniqueSlashes.size, 30);

  const first = days[0];
  assert.equal(first.slashDate, '1405/08/01');
  assert.equal(first.dashDate, '1405-08-01');
  assert.equal(first.monthName, 'آبان');
  assert.equal(first.monthLatin, 'Aban');

  const twelfth = days[11];
  assert.equal(twelfth.slashDate, '1405/08/12');
  assert.equal(twelfth.dashDate, '1405-08-12');
  assert.equal(twelfth.dayStr, '12');

  const last = days[29];
  assert.equal(last.slashDate, '1405/08/30');
  assert.equal(last.dashDate, '1405-08-30');
});

test('month naming returns expected Persian and Latin names', () => {
  assert.equal(PERSIAN_MONTHS.length, 12);
  assert.equal(getMonthName(1), 'فروردین');
  assert.equal(getMonthLatinName(1), 'Farvardin');
  assert.equal(getMonthName(8), 'آبان');
  assert.equal(getMonthLatinName(8), 'Aban');
  assert.equal(getMonthName(12), 'اسفند');
  assert.equal(getMonthLatinName(12), 'Esfand');
});
