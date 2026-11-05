/**
 * PwKaraWeb Excel Exporter - Date Manager
 * Handles Persian (Solar Hijri / Jalali) calendar calculations,
 * leap year detection, month lengths, date validation, and formatting.
 * Supports:
 *  1. Single month daily export (ماه مشخص)
 *  2. Full year daily export (کل سال مشخص - ۳۶۵ یا ۳۶۶ روز)
 *  3. Arbitrary cross-month/cross-year date ranges (بازه بین دو تاریخ دلخواه)
 */

export const OUTPUT_MODES = {
  MONTH: 'month',               // Specific month of a specific year
  YEAR: 'year',                 // Entire year (all 12 months)
  CUSTOM_RANGE: 'custom_range'  // Date range between two arbitrary dates
};

export const PERSIAN_MONTHS = [
  { id: 1, name: 'فروردین', latin: 'Farvardin' },
  { id: 2, name: 'اردیبهشت', latin: 'Ordibehesht' },
  { id: 3, name: 'خرداد', latin: 'Khordad' },
  { id: 4, name: 'تیر', latin: 'Tir' },
  { id: 5, name: 'مرداد', latin: 'Mordad' },
  { id: 6, name: 'شهریور', latin: 'Shahrivar' },
  { id: 7, name: 'مهر', latin: 'Mehr' },
  { id: 8, name: 'آبان', latin: 'Aban' },
  { id: 9, name: 'آذر', latin: 'Azar' },
  { id: 10, name: 'دی', latin: 'Dey' },
  { id: 11, name: 'بهمن', latin: 'Bahman' },
  { id: 12, name: 'اسفند', latin: 'Esfand' }
];

/**
 * Standard Jalali calendar break table (Ahmad Birashk / jalaali algorithm).
 * Accurately calculates leap years across centuries without naive 4-year approximations.
 */
const JALALI_BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
  1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
];

/**
 * Determines whether a given Persian year is a leap year (کبیسه).
 * @param {number|string} year - Persian year (e.g., 1403, 1405)
 * @returns {boolean} True if leap year, false otherwise
 */
export function isLeapYear(year) {
  const jy = Number(year);
  if (isNaN(jy) || jy < 1200 || jy > 1600) {
    // Fallback approximation for out-of-range years
    return ((jy % 33) % 4) === 1;
  }

  const bl = JALALI_BREAKS.length;
  let jp = JALALI_BREAKS[0];
  let jm = 0;
  let jump = 0;

  for (let i = 1; i < bl; i++) {
    jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }

  let n = jy - jp;
  if (jump - n < 6) {
    n = n - jump + Math.floor((jump + 4) / 33) * 33;
  }

  let leap = ((((n + 1) % 33) - 1) % 4);
  if (leap === -1) {
    leap = 4;
  }
  return leap === 0;
}

/**
 * Returns the number of days in a given Persian month and year.
 * Months 1-6: 31 days
 * Months 7-11: 30 days
 * Month 12: 30 days if leap year, otherwise 29 days
 * @param {number|string} year
 * @param {number|string} month (1-12)
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  const m = Number(month);
  const y = Number(year);

  if (m < 1 || m > 12) {
    throw new Error(`ماه نامعتبر است: ${month}. باید بین ۱ تا ۱۲ باشد.`);
  }

  if (m >= 1 && m <= 6) {
    return 31;
  }
  if (m >= 7 && m <= 11) {
    return 30;
  }
  // Month 12 (Esfand)
  return isLeapYear(y) ? 30 : 29;
}

/**
 * Returns total days in a given Persian year (366 for leap, 365 for normal).
 * @param {number|string} year
 * @returns {number}
 */
export function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Zero-pads a number to length 2 (or specified length).
 * @param {number|string} n
 * @param {number} len
 * @returns {string}
 */
export function padZero(n, len = 2) {
  return String(n).padStart(len, '0');
}

/**
 * Returns Persian month name by month number (1-12).
 * @param {number|string} month
 * @returns {string}
 */
export function getMonthName(month) {
  const m = Number(month);
  const item = PERSIAN_MONTHS.find(x => x.id === m);
  return item ? item.name : '';
}

/**
 * Returns Latin month name by month number (1-12).
 * @param {number|string} month
 * @returns {string}
 */
export function getMonthLatinName(month) {
  const m = Number(month);
  const item = PERSIAN_MONTHS.find(x => x.id === m);
  return item ? item.latin : '';
}

/**
 * Formats a Persian date with slash (YYYY/MM/DD) as required by PwKaraWeb form fields.
 * @param {number|string} year
 * @param {number|string} month
 * @param {number|string} day
 * @returns {string} e.g. "1405/08/12"
 */
export function formatSlashDate(year, month, day) {
  return `${Number(year)}/${padZero(month)}/${padZero(day)}`;
}

/**
 * Formats a Persian date with hyphen (YYYY-MM-DD).
 * @param {number|string} year
 * @param {number|string} month
 * @param {number|string} day
 * @returns {string} e.g. "1405-08-12"
 */
export function formatDashDate(year, month, day) {
  return `${Number(year)}-${padZero(month)}-${padZero(day)}`;
}

/**
 * Compares two Persian dates chronologically.
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function comparePersianDates(y1, m1, d1, y2, m2, d2) {
  const num1 = Number(y1) * 10000 + Number(m1) * 100 + Number(d1);
  const num2 = Number(y2) * 10000 + Number(m2) * 100 + Number(d2);
  if (num1 < num2) return -1;
  if (num1 > num2) return 1;
  return 0;
}

/**
 * Calculates the next calendar day in Persian calendar.
 * Handles month and year rollovers with leap year precision.
 * @param {number} y
 * @param {number} m
 * @param {number} d
 * @returns {{ year: number, month: number, day: number }}
 */
export function getNextPersianDay(y, m, d) {
  const maxDays = getDaysInMonth(y, m);
  if (d < maxDays) {
    return { year: y, month: m, day: d + 1 };
  }
  if (m < 12) {
    return { year: y, month: m + 1, day: 1 };
  }
  return { year: y + 1, month: 1, day: 1 };
}

/**
 * Validates selected year, month, and day range within a single month.
 * @param {number|string} year
 * @param {number|string} month
 * @param {number|string} startDay
 * @param {number|string} endDay
 * @returns {{ valid: boolean, error?: string, maxDays: number }}
 */
export function validateDateRange(year, month, startDay, endDay) {
  const y = Number(year);
  const m = Number(month);
  const s = Number(startDay);
  const e = Number(endDay);

  if (isNaN(y) || y < 1300 || y > 1500) {
    return { valid: false, error: 'سال شمسی باید عددی بین ۱۳۰۰ تا ۱۵۰۰ باشد.', maxDays: 0 };
  }

  if (isNaN(m) || m < 1 || m > 12) {
    return { valid: false, error: 'ماه انتخابی باید بین ۱ تا ۱۲ باشد.', maxDays: 0 };
  }

  const maxDays = getDaysInMonth(y, m);

  if (isNaN(s) || s < 1 || s > maxDays) {
    return {
      valid: false,
      error: `روز شروع باید بین ۱ تا ${maxDays} باشد (ماه ${getMonthName(m)} دارای ${maxDays} روز است).`,
      maxDays
    };
  }

  if (isNaN(e) || e < 1 || e > maxDays) {
    return {
      valid: false,
      error: `روز پایان باید بین ۱ تا ${maxDays} باشد (ماه ${getMonthName(m)} دارای ${maxDays} روز است).`,
      maxDays
    };
  }

  if (s > e) {
    return {
      valid: false,
      error: 'روز شروع نمی‌تواند بعد از روز پایان باشد.',
      maxDays
    };
  }

  return { valid: true, maxDays };
}

/**
 * Validates an arbitrary date range between two dates (which can cross months and years).
 * @param {number|string} fromYear
 * @param {number|string} fromMonth
 * @param {number|string} fromDay
 * @param {number|string} toYear
 * @param {number|string} toMonth
 * @param {number|string} toDay
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCustomDateRange(fromYear, fromMonth, fromDay, toYear, toMonth, toDay) {
  const fy = Number(fromYear);
  const fm = Number(fromMonth);
  const fd = Number(fromDay);
  const ty = Number(toYear);
  const tm = Number(toMonth);
  const td = Number(toDay);

  if (isNaN(fy) || fy < 1300 || fy > 1500 || isNaN(ty) || ty < 1300 || ty > 1500) {
    return { valid: false, error: 'سال‌های انتخابی باید بین ۱۳۰۰ تا ۱۵۰۰ باشند.' };
  }

  if (isNaN(fm) || fm < 1 || fm > 12 || isNaN(tm) || tm < 1 || tm > 12) {
    return { valid: false, error: 'ماه‌های انتخابی باید بین ۱ تا ۱۲ باشند.' };
  }

  const maxFromDays = getDaysInMonth(fy, fm);
  if (isNaN(fd) || fd < 1 || fd > maxFromDays) {
    return { valid: false, error: `روز شروع باید بین ۱ تا ${maxFromDays} باشد.` };
  }

  const maxToDays = getDaysInMonth(ty, tm);
  if (isNaN(td) || td < 1 || td > maxToDays) {
    return { valid: false, error: `روز پایان باید بین ۱ تا ${maxToDays} باشد.` };
  }

  if (comparePersianDates(fy, fm, fd, ty, tm, td) > 0) {
    return { valid: false, error: 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.' };
  }

  return { valid: true };
}

/**
 * Generates daily date objects for a single month range (Mode 1: Specific Month).
 * @param {number|string} year
 * @param {number|string} month
 * @param {number|string} startDay
 * @param {number|string} endDay
 * @returns {Array<Object>}
 */
export function generateDateList(year, month, startDay, endDay) {
  const validation = validateDateRange(year, month, startDay, endDay);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const y = Number(year);
  const m = Number(month);
  const s = Number(startDay);
  const e = Number(endDay);

  const dates = [];
  for (let day = s; day <= e; day++) {
    const yearStr = String(y);
    const monthStr = padZero(m);
    const dayStr = padZero(day);
    dates.push({
      year: y,
      month: m,
      day,
      yearStr,
      monthStr,
      dayStr,
      slashDate: `${yearStr}/${monthStr}/${dayStr}`,
      dashDate: `${yearStr}-${monthStr}-${dayStr}`,
      monthName: getMonthName(m),
      monthLatin: getMonthLatinName(m)
    });
  }

  return dates;
}

/**
 * Generates all 365 or 366 daily date objects for an entire year (Mode 2: Entire Year).
 * @param {number|string} year
 * @returns {Array<Object>}
 */
export function generateYearDateList(year) {
  const y = Number(year);
  if (isNaN(y) || y < 1300 || y > 1500) {
    throw new Error('سال شمسی نامعتبر است.');
  }

  const dates = [];
  for (let m = 1; m <= 12; m++) {
    const maxDays = getDaysInMonth(y, m);
    for (let d = 1; d <= maxDays; d++) {
      const yearStr = String(y);
      const monthStr = padZero(m);
      const dayStr = padZero(d);
      dates.push({
        year: y,
        month: m,
        day: d,
        yearStr,
        monthStr,
        dayStr,
        slashDate: `${yearStr}/${monthStr}/${dayStr}`,
        dashDate: `${yearStr}-${monthStr}-${dayStr}`,
        monthName: getMonthName(m),
        monthLatin: getMonthLatinName(m)
      });
    }
  }

  return dates;
}

/**
 * Generates all daily date objects between two arbitrary dates (Mode 3: Custom Date Range).
 * Can cross across months and years seamlessly.
 *
 * @param {number|string} fromYear
 * @param {number|string} fromMonth
 * @param {number|string} fromDay
 * @param {number|string} toYear
 * @param {number|string} toMonth
 * @param {number|string} toDay
 * @returns {Array<Object>}
 */
export function generateCustomRangeDateList(fromYear, fromMonth, fromDay, toYear, toMonth, toDay) {
  const validation = validateCustomDateRange(fromYear, fromMonth, fromDay, toYear, toMonth, toDay);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const dates = [];
  let curr = {
    year: Number(fromYear),
    month: Number(fromMonth),
    day: Number(fromDay)
  };

  const end = {
    year: Number(toYear),
    month: Number(toMonth),
    day: Number(toDay)
  };

  while (comparePersianDates(curr.year, curr.month, curr.day, end.year, end.month, end.day) <= 0) {
    const yearStr = String(curr.year);
    const monthStr = padZero(curr.month);
    const dayStr = padZero(curr.day);
    dates.push({
      year: curr.year,
      month: curr.month,
      day: curr.day,
      yearStr,
      monthStr,
      dayStr,
      slashDate: `${yearStr}/${monthStr}/${dayStr}`,
      dashDate: `${yearStr}-${monthStr}-${dayStr}`,
      monthName: getMonthName(curr.month),
      monthLatin: getMonthLatinName(curr.month)
    });

    curr = getNextPersianDay(curr.year, curr.month, curr.day);
  }

  return dates;
}

/**
 * Detects current Persian date using Intl API.
 * @returns {{ year: number, month: number, day: number }}
 */
export function getCurrentPersianDate() {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const yearPart = parts.find(p => p.type === 'year');
    const monthPart = parts.find(p => p.type === 'month');
    const dayPart = parts.find(p => p.type === 'day');

    if (yearPart && monthPart && dayPart) {
      return {
        year: parseInt(yearPart.value, 10),
        month: parseInt(monthPart.value, 10),
        day: parseInt(dayPart.value, 10)
      };
    }
  } catch (err) {
    console.warn('Persian Intl formatter failed, using default', err);
  }

  // Fallback if Intl Persian is unavailable
  return { year: 1403, month: 1, day: 1 };
}
