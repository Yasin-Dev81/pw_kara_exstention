import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLeapYear,
  getDaysInMonth,
  getDaysInYear,
  validateDateRange,
  validateCustomDateRange,
  generateDateList,
  generateYearDateList,
  generateCustomRangeDateList,
  comparePersianDates,
  getNextPersianDay,
  formatSlashDate,
  formatDashDate,
  getMonthName,
  getMonthLatinName,
  PERSIAN_MONTHS,
  OUTPUT_MODES
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

test('getDaysInMonth and getDaysInYear validate month & year lengths properly', () => {
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

  // Year lengths
  assert.equal(getDaysInYear(1403), 366);
  assert.equal(getDaysInYear(1404), 365);

  // Invalid month throws
  assert.throws(() => getDaysInMonth(1403, 0));
  assert.throws(() => getDaysInMonth(1403, 13));
});

test('validateDateRange validates dates correctly within single month', () => {
  assert.equal(validateDateRange(1403, 1, 1, 31).valid, true);
  assert.equal(validateDateRange(1403, 7, 1, 30).valid, true);
  assert.equal(validateDateRange(1403, 12, 1, 30).valid, true); // 1403 is leap
  assert.equal(validateDateRange(1404, 12, 1, 29).valid, true); // 1404 non-leap

  // Invalid: start > end
  const res1 = validateDateRange(1403, 1, 20, 10);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /شروع نمی‌تواند بعد از روز پایان/);

  // Invalid: end day exceeds month length
  const res2 = validateDateRange(1404, 12, 1, 30);
  assert.equal(res2.valid, false);
  assert.match(res2.error, /(?:۲۹|29) روز است/);
});

test('Mode 1: generateDateList generates month days without duplicates', () => {
  const days = generateDateList(1405, 8, 1, 30);
  assert.equal(days.length, 30);

  const uniqueSlashes = new Set(days.map(d => d.slashDate));
  assert.equal(uniqueSlashes.size, 30);

  assert.equal(days[0].slashDate, '1405/08/01');
  assert.equal(days[11].slashDate, '1405/08/12');
  assert.equal(days[29].slashDate, '1405/08/30');
});

test('Mode 2: generateYearDateList generates all 365/366 days for the entire year', () => {
  // Leap year 1403 -> exactly 366 days
  const year1403 = generateYearDateList(1403);
  assert.equal(year1403.length, 366);
  assert.equal(year1403[0].slashDate, '1403/01/01');
  assert.equal(year1403[year1403.length - 1].slashDate, '1403/12/30');

  // Verify uniqueness of all 366 dates
  const unique1403 = new Set(year1403.map(d => d.slashDate));
  assert.equal(unique1403.size, 366);

  // Non-leap year 1404 -> exactly 365 days
  const year1404 = generateYearDateList(1404);
  assert.equal(year1404.length, 365);
  assert.equal(year1404[0].slashDate, '1404/01/01');
  assert.equal(year1404[year1404.length - 1].slashDate, '1404/12/29');
});

test('Mode 3: generateCustomRangeDateList generates consecutive days across months and years', () => {
  // 1. Within single month: 1403/08/10 to 1403/08/15 (6 days)
  const range1 = generateCustomRangeDateList(1403, 8, 10, 1403, 8, 15);
  assert.equal(range1.length, 6);
  assert.equal(range1[0].slashDate, '1403/08/10');
  assert.equal(range1[5].slashDate, '1403/08/15');

  // 2. Crossing month boundary: 1403/06/30 to 1403/07/02 (Shahrivar 30, 31, Mehr 1, 2 = 4 days)
  const rangeCrossMonth = generateCustomRangeDateList(1403, 6, 30, 1403, 7, 2);
  assert.equal(rangeCrossMonth.length, 4);
  assert.deepEqual(rangeCrossMonth.map(d => d.slashDate), [
    '1403/06/30',
    '1403/06/31',
    '1403/07/01',
    '1403/07/02'
  ]);

  // 3. Crossing leap year boundary: 1403/12/29 to 1404/01/02 (1403/12/29, 1403/12/30, 1404/01/01, 1404/01/02 = 4 days)
  const rangeCrossYear = generateCustomRangeDateList(1403, 12, 29, 1404, 1, 2);
  assert.equal(rangeCrossYear.length, 4);
  assert.deepEqual(rangeCrossYear.map(d => d.slashDate), [
    '1403/12/29',
    '1403/12/30',
    '1404/01/01',
    '1404/01/02'
  ]);

  // 4. Crossing non-leap year boundary: 1404/12/28 to 1405/01/02 (1404/12/28, 1404/12/29, 1405/01/01, 1405/01/02 = 4 days)
  const rangeNonLeapYear = generateCustomRangeDateList(1404, 12, 28, 1405, 1, 2);
  assert.equal(rangeNonLeapYear.length, 4);
  assert.deepEqual(rangeNonLeapYear.map(d => d.slashDate), [
    '1404/12/28',
    '1404/12/29',
    '1405/01/01',
    '1405/01/02'
  ]);
});

test('validateCustomDateRange rejects invalid ranges', () => {
  // Start date after end date
  const invalidOrder = validateCustomDateRange(1403, 8, 20, 1403, 8, 10);
  assert.equal(invalidOrder.valid, false);
  assert.match(invalidOrder.error, /تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد/);

  // Cross-year invalid order
  const invalidCrossYear = validateCustomDateRange(1404, 1, 1, 1403, 12, 29);
  assert.equal(invalidCrossYear.valid, false);

  // Invalid day in month
  const invalidDay = validateCustomDateRange(1404, 12, 30, 1405, 1, 5); // 1404 has 29 days in Esfand
  assert.equal(invalidDay.valid, false);

  // Valid range
  assert.equal(validateCustomDateRange(1403, 7, 1, 1403, 9, 30).valid, true);
});

test('comparePersianDates compares dates accurately', () => {
  assert.equal(comparePersianDates(1403, 8, 10, 1403, 8, 10), 0);
  assert.equal(comparePersianDates(1403, 8, 9, 1403, 8, 10), -1);
  assert.equal(comparePersianDates(1403, 8, 11, 1403, 8, 10), 1);
  assert.equal(comparePersianDates(1402, 12, 29, 1403, 1, 1), -1);
  assert.equal(comparePersianDates(1404, 1, 1, 1403, 12, 30), 1);
});
