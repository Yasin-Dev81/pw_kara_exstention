import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDownloadPath,
  formatMonthFolder,
  sanitizeFolderSegment,
  FOLDER_MODES,
  MONTH_NAMING_STYLES
} from '../modules/folder-manager.js';

test('buildDownloadPath generates expected paths for Mode 1 (Year / Month)', () => {
  // Latin month style: Karkard/1405/08-Aban/1405-08-12.xls
  const pathLatin = buildDownloadPath({
    filename: '1405-08-12.xls',
    year: 1405,
    month: 8,
    mode: FOLDER_MODES.YEAR_MONTH,
    rootFolder: 'Karkard',
    monthStyle: MONTH_NAMING_STYLES.LATIN
  });
  assert.equal(pathLatin, 'Karkard/1405/08-Aban/1405-08-12.xls');

  // Persian month style: Karkard/1405/08-آبان/1405-08-12.xls
  const pathPersian = buildDownloadPath({
    filename: '1405-08-12.xls',
    year: 1405,
    month: 8,
    mode: FOLDER_MODES.YEAR_MONTH,
    rootFolder: 'Karkard',
    monthStyle: MONTH_NAMING_STYLES.PERSIAN
  });
  assert.equal(pathPersian, 'Karkard/1405/08-آبان/1405-08-12.xls');

  // Numeric month style: Karkard/1405/08/1405-08-12.xls
  const pathNumeric = buildDownloadPath({
    filename: '1405-08-12.xls',
    year: 1405,
    month: 8,
    mode: FOLDER_MODES.YEAR_MONTH,
    rootFolder: 'Karkard',
    monthStyle: MONTH_NAMING_STYLES.NUMERIC
  });
  assert.equal(pathNumeric, 'Karkard/1405/08/1405-08-12.xls');
});

test('buildDownloadPath generates expected paths for Mode 2 (Month only)', () => {
  // Example: Karkard/1405-08-Aban/1405-08-12.xls
  const path = buildDownloadPath({
    filename: '1405-08-12.xls',
    year: 1405,
    month: 8,
    mode: FOLDER_MODES.MONTH_ONLY,
    rootFolder: 'Karkard',
    monthStyle: MONTH_NAMING_STYLES.LATIN
  });
  assert.equal(path, 'Karkard/1405-08-Aban/1405-08-12.xls');

  // Numeric: Karkard/1405-08/1405-08-12.xls
  const pathNum = buildDownloadPath({
    filename: '1405-08-12.xls',
    year: 1405,
    month: 8,
    mode: FOLDER_MODES.MONTH_ONLY,
    rootFolder: 'Karkard',
    monthStyle: MONTH_NAMING_STYLES.NUMERIC
  });
  assert.equal(pathNum, 'Karkard/1405-08/1405-08-12.xls');
});

test('buildDownloadPath generates expected paths for Mode 3 (No subfolders)', () => {
  // Example: Karkard/1405-08-12.xls
  const path = buildDownloadPath({
    filename: '1405-08-12.xls',
    year: 1405,
    month: 8,
    mode: FOLDER_MODES.NO_SUBFOLDERS,
    rootFolder: 'Karkard'
  });
  assert.equal(path, 'Karkard/1405-08-12.xls');
});

test('sanitizeFolderSegment strips illegal characters and prevents path traversal', () => {
  const traversal = '../../Secret:Folder/Name*';
  const clean = sanitizeFolderSegment(traversal);
  assert.equal(clean.includes('..'), false);
  assert.equal(clean.includes(':'), false);
  assert.equal(clean.includes('*'), false);
});
