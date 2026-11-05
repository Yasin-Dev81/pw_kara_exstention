import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateFilename,
  previewFilename,
  sanitizeFilename,
  sanitizePrefix,
  validateTemplate,
  PREDEFINED_TEMPLATES,
  DEFAULT_FILENAME_TEMPLATE,
  DEFAULT_PREFIX
} from '../modules/filename-manager.js';

test('generateFilename replaces placeholders correctly with report date', () => {
  // Test requirement example: {prefix}_{year}_{month}_{day}.xls -> Karkard_1405_08_12.xls
  const filename = generateFilename({
    template: '{prefix}_{year}_{month}_{day}.xls',
    prefix: 'Karkard',
    year: 1405,
    month: 8,
    day: 12
  });
  assert.equal(filename, 'Karkard_1405_08_12.xls');

  // Complete date placeholder {date}
  const fDate = generateFilename({
    template: '{prefix}_{date}.xls',
    prefix: 'Karkard',
    year: 1405,
    month: 8,
    day: 12
  });
  assert.equal(fDate, 'Karkard_1405-08-12.xls');

  // Single digit month/day zero-padded
  const fPadded = generateFilename({
    template: '{year}-{month}-{day}.xls',
    year: 1403,
    month: 5,
    day: 7
  });
  assert.equal(fPadded, '1403-05-07.xls');
});

test('predefined templates match all four specifications', () => {
  assert.equal(PREDEFINED_TEMPLATES.length, 4);

  // 1. {year}-{month}-{day}.xls
  assert.equal(
    generateFilename({ template: PREDEFINED_TEMPLATES[0].template, year: 1405, month: 8, day: 12 }),
    '1405-08-12.xls'
  );

  // 2. {year}_{month}_{day}.xls
  assert.equal(
    generateFilename({ template: PREDEFINED_TEMPLATES[1].template, year: 1405, month: 8, day: 12 }),
    '1405_08_12.xls'
  );

  // 3. {prefix}_{year}-{month}-{day}.xls
  assert.equal(
    generateFilename({ template: PREDEFINED_TEMPLATES[2].template, prefix: 'Karkard', year: 1405, month: 8, day: 12 }),
    'Karkard_1405-08-12.xls'
  );

  // 4. {prefix}_{year}_{month}_{day}.xls
  assert.equal(
    generateFilename({ template: PREDEFINED_TEMPLATES[3].template, prefix: 'Karkard', year: 1405, month: 8, day: 12 }),
    'Karkard_1405_08_12.xls'
  );
});

test('sanitizeFilename removes illegal filesystem characters', () => {
  // Characters: / \ : * ? " < > |
  const unsafe = 'Report/Illegal:Name*With?Bad"Chars<And>Pipes|End';
  const clean = sanitizeFilename(unsafe, '_');
  assert.equal(clean, 'Report_Illegal_Name_With_Bad_Chars_And_Pipes_End');

  // Sanitizing prefix
  const unsafePrefix = 'Bad:Prefix/With\\Slash*';
  assert.equal(sanitizePrefix(unsafePrefix), 'BadPrefixWithSlash');
});

test('generateFilename ensures .xls extension is present', () => {
  const withoutExt = generateFilename({
    template: '{year}-{month}-{day}',
    year: 1405,
    month: 8,
    day: 12
  });
  assert.equal(withoutExt, '1405-08-12.xls');

  const withXlsx = generateFilename({
    template: '{year}-{month}-{day}.xlsx',
    year: 1405,
    month: 8,
    day: 12
  });
  assert.equal(withXlsx, '1405-08-12.xls');
});

test('validateTemplate checks that templates differentiate daily files', () => {
  // Must include {day} or {date}
  assert.equal(validateTemplate('{year}-{month}-{day}.xls').valid, true);
  assert.equal(validateTemplate('{date}.xls').valid, true);

  // Template without day or date should fail validation to prevent overwrites
  const invalid = validateTemplate('{year}_{month}.xls');
  assert.equal(invalid.valid, false);
  assert.match(invalid.error, /حداقل شامل \{day\} یا \{date\} باشد/);

  // Empty template
  assert.equal(validateTemplate('').valid, false);
});
