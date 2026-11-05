/**
 * PwKaraWeb Excel Exporter - Release Packaging Script
 * Creates a clean zip archive of the extension ready for GitHub Releases
 * and Chrome Web Store upload, excluding test files, git, and dev dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const version = manifest.version || '1.1.0';

const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipFileName = `pwkaraweb-excel-exporter-v${version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);

// Remove existing archive if present
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

// List of files and folders to include
const includeItems = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'popup.js',
  'background',
  'content',
  'modules',
  'styles',
  'assets',
  'README.md',
  'LICENSE'
];

console.log(`Packaging PwKaraWeb Excel Exporter v${version}...`);

try {
  // Use system zip for maximum compatibility
  const itemsArg = includeItems.join(' ');
  execSync(`zip -r -9 "${zipFilePath}" ${itemsArg} -x "*.DS_Store"`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  const stats = fs.statSync(zipFilePath);
  const sizeKb = (stats.size / 1024).toFixed(1);
  console.log(`\nSuccessfully created release package:`);
  console.log(`File: ${zipFilePath}`);
  console.log(`Size: ${sizeKb} KB\n`);
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}
