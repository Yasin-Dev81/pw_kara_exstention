/**
 * PwKaraWeb Excel Exporter - Filename Manager
 * Manages filename templates, placeholder replacement,
 * sanitization, and live preview generation.
 */

export const PREDEFINED_TEMPLATES = [
  { id: 't1', template: '{year}-{month}-{day}.xls', label: '1405-08-12.xls' },
  { id: 't2', template: '{year}_{month}_{day}.xls', label: '1405_08_12.xls' },
  { id: 't3', template: '{prefix}_{year}-{month}-{day}.xls', label: 'Karkard_1405-08-12.xls' },
  { id: 't4', template: '{prefix}_{year}_{month}_{day}.xls', label: 'Karkard_1405_08_12.xls' }
];

export const DEFAULT_FILENAME_TEMPLATE = '{prefix}_{year}_{month}_{day}.xls';
export const DEFAULT_PREFIX = 'Karkard';

/**
 * Characters not allowed in Windows and POSIX filenames:
 * < > : " / \ | ? * and ASCII control characters (0-31)
 */
const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Sanitizes a filename or path segment by removing forbidden characters.
 * @param {string} name
 * @param {string} replacement - Character to replace invalid chars with (default: '_')
 * @returns {string}
 */
export function sanitizeFilename(name, replacement = '_') {
  if (!name || typeof name !== 'string') return 'report.xls';
  let sanitized = name.replace(INVALID_FILENAME_CHARS_REGEX, replacement);
  // Remove consecutive replacements and trim spaces/dots
  sanitized = sanitized.replace(new RegExp(`\\${replacement}+`, 'g'), replacement);
  sanitized = sanitized.trim();
  // Strip trailing dots or spaces which are problematic on Windows
  sanitized = sanitized.replace(/[. ]+$/, '');
  if (!sanitized) return 'report.xls';
  return sanitized;
}

/**
 * Sanitizes user-provided prefix (cannot contain invalid filename chars).
 * @param {string} prefix
 * @returns {string}
 */
export function sanitizePrefix(prefix) {
  if (!prefix || typeof prefix !== 'string') return DEFAULT_PREFIX;
  const cleaned = prefix.replace(INVALID_FILENAME_CHARS_REGEX, '').trim();
  return cleaned || DEFAULT_PREFIX;
}

/**
 * Generates a filename for a specific date using the given template and prefix.
 * @param {Object} options
 * @param {string} options.template - Template string (e.g. "{prefix}_{year}_{month}_{day}.xls")
 * @param {string} options.prefix - User prefix (e.g. "Karkard")
 * @param {number|string} options.year - Persian year (e.g. 1405)
 * @param {number|string} options.month - Persian month (e.g. 8 or "08")
 * @param {number|string} options.day - Persian day (e.g. 12 or "12")
 * @returns {string} Validated and sanitized filename (e.g. "Karkard_1405_08_12.xls")
 */
export function generateFilename({
  template = DEFAULT_FILENAME_TEMPLATE,
  prefix = DEFAULT_PREFIX,
  year,
  month,
  day
}) {
  const yStr = String(year || 1405);
  const mStr = String(month || 1).padStart(2, '0');
  const dStr = String(day || 1).padStart(2, '0');
  const dateStr = `${yStr}-${mStr}-${dStr}`;
  const safePrefix = sanitizePrefix(prefix);

  let raw = (template || DEFAULT_FILENAME_TEMPLATE)
    .replace(/\{prefix\}/gi, safePrefix)
    .replace(/\{year\}/gi, yStr)
    .replace(/\{month\}/gi, mStr)
    .replace(/\{day\}/gi, dStr)
    .replace(/\{date\}/gi, dateStr);

  // Ensure it has .xls extension
  if (!/\.xls$/i.test(raw)) {
    if (/\.xlsx$/i.test(raw)) {
      raw = raw.replace(/\.xlsx$/i, '.xls');
    } else {
      raw += '.xls';
    }
  }

  // Separate name and extension for sanitization
  const dotIndex = raw.lastIndexOf('.');
  const baseName = dotIndex !== -1 ? raw.substring(0, dotIndex) : raw;
  const ext = dotIndex !== -1 ? raw.substring(dotIndex) : '.xls';

  const sanitizedBase = sanitizeFilename(baseName, '_');
  return `${sanitizedBase}${ext}`;
}

/**
 * Generates a preview filename for the UI using sample/selected date.
 * @param {string} template
 * @param {string} prefix
 * @param {number|string} [year=1405]
 * @param {number|string} [month=8]
 * @param {number|string} [day=12]
 * @returns {string}
 */
export function previewFilename(template, prefix, year = 1405, month = 8, day = 12) {
  return generateFilename({ template, prefix, year, month, day });
}

/**
 * Validates whether a template string has valid placeholders.
 * @param {string} template
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTemplate(template) {
  if (!template || typeof template !== 'string' || !template.trim()) {
    return { valid: false, error: 'قالب نام فایل نمی‌تواند خالی باشد.' };
  }

  // Must contain at least {day} or {date} to avoid overwriting files across days
  const hasDay = /\{day\}/i.test(template);
  const hasDate = /\{date\}/i.test(template);

  if (!hasDay && !hasDate) {
    return {
      valid: false,
      error: 'قالب نام فایل باید حداقل شامل {day} یا {date} باشد تا نام فایل‌ها در روزهای مختلف تکراری نشود.'
    };
  }

  return { valid: true };
}
