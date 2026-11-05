# Changelog

All notable changes to the **PwKaraWeb Excel Exporter** project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-05

### Added
- **Three Selectable Daily Output Modes**:
  - **Mode 1 (Specific Month):** Export all or selected days of a specific Persian month.
  - **Mode 2 (Entire Specified Year):** Automatically iterates and exports all 365 days (or 366 days in leap years) across all 12 months with automatic subfolder organization.
  - **Mode 3 (Custom Date Range):** Full support for arbitrary date intervals between two dates, seamlessly transitioning across months and years.
- **Glisse Liquid Glass UI Integration**:
  - Implemented Apple Liquid Glass aesthetic using Kelvin Zhang's [Glisse](https://glisse.kelvinzhang.com/) library.
  - Liquid glass segmented controls (`.lg-segmented`) for fast mode switching.
  - Frosted glass cards, translucent backdrop blur (`backdrop-filter: blur(16px) saturate(1.8)`), refractive edge shines, and tactile buttons.
  - Ambient illumination background mesh for enhanced visual depth.
- **Enhanced Calendar Math**:
  - `generateYearDateList` for 365/366 day batches.
  - `generateCustomRangeDateList` and `getNextPersianDay` for day-by-day sequential calendar steps.
  - `validateCustomDateRange` and `comparePersianDates`.
- **Release Automation**:
  - `npm run package` script producing a clean `.zip` archive for GitHub Releases and Chrome Web Store.
  - GitHub Actions CI workflow running automated tests across Node 18, 20, and 22.

### Changed
- Expanded automated unit test suite from 25 to 29 tests with 100% pass rate.
- Modernized popup layout and typography.

---

## [1.0.0] - 2026-11-05

### Added
- Initial production-ready release of PwKaraWeb Excel Exporter Chrome Extension (Manifest V3).
- Automatic detection of PwKaraWeb reporting endpoint (`/KaraReports/KarkardSummary`).
- Dynamic form extraction: reads active `FormData`, preserves `__RequestVerificationToken`, employee filters, and report selections.
- Simultaneous update of all 4 mandatory date parameters (`StartDate`, `EndDate`, `MonthSelector1StartDateFormatted`, `MonthSelector1EndDateFormatted`).
- Explicit insertion of the Excel command button parameter (`command = ایجاد جدول اکسل`).
- Rate-limiting request pacing (minimum 2.0s delay, default 2.5s).
- Binary Excel validation (OLE2 magic bytes check to detect and prevent saving HTML login error pages as `.xls`).
- Customizable filename templates with placeholders (`{year}`, `{month}`, `{day}`, `{date}`, `{prefix}`).
- Flexible folder organization (Mode 1: Year/Month, Mode 2: Month, Mode 3: No subfolders).
- Persian RTL UI with offline Vazirmatn font.
- Export history logging up to 50 jobs in `chrome.storage.local`.
- Unit test suite for calendar calculations, leap years, filename sanitization, and mock POST requests.
