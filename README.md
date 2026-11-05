# PwKaraWeb Excel Exporter 📊✨
### Chrome Extension (Manifest V3) with Liquid Glass UI ([Glisse](https://glisse.kelvinzhang.com/))

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![CI Tests](https://img.shields.io/badge/CI-Passing%20(29%2F29)-34A853?style=flat-square&logo=githubactions&logoColor=white)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Glisse UI](https://img.shields.io/badge/UI-Glisse%20Liquid%20Glass-0088FF?style=flat-square)](https://glisse.kelvinzhang.com/)
[![Persian Calendar](https://img.shields.io/badge/Calendar-Jalali%20(Solar%20Hijri)-orange?style=flat-square)](modules/date-manager.js)
[![Release](https://img.shields.io/badge/Release-v1.1.0-107C41?style=flat-square)](CHANGELOG.md)

---

## 🌐 Quick English Overview

**PwKaraWeb Excel Exporter** is a production-ready, client-side Google Chrome Extension (Manifest V3) designed for automated daily Excel report exports from the **PwKaraWeb** attendance and access-control system. 

It features an Apple-inspired **Liquid Glass UI** powered by Kelvin Zhang's [Glisse](https://glisse.kelvinzhang.com/) library, native Persian (Solar Hijri) calendar calculations with accurate leap-year algorithms, customizable naming templates, flexible folder organization, and safe download lifecycle management.

### Key Features:
- **3 Flexible Daily Output Modes**:
  1. **Specific Month**: Export selected or all days of a given month.
  2. **Entire Year**: Automatically export all 365 or 366 days across all 12 months in organized folders.
  3. **Custom Date Range**: Export all days between any two arbitrary dates (supports crossing months and years).
- **Session & CSRF Safety**: Dynamically inherits active session cookies (`.ASPXAUTH`) and anti-forgery tokens (`__RequestVerificationToken`) from the live DOM without saving or leaking credentials.
- **Simultaneous Date Field Pacing**: Simultaneously sets all 4 required date fields (`StartDate`, `EndDate`, `MonthSelector1StartDateFormatted`, `MonthSelector1EndDateFormatted`) for single-day reports.
- **Liquid Glass Aesthetic**: Glass panels, translucent blur, refractive lenses, tactile buttons, and segmented controls.
- **Robust Error Handling**: Inspects response binaries to prevent saving HTML error/login pages as `.xls`.
- **Offline & Standalone**: Fully bundled with local Vazirmatn fonts and zero external runtime dependencies.

---

<div dir="rtl" align="right">

## 🇮🇷 راهنمای جامع فارسی (Persian Documentation)

یک افزونه پیشرفته، امن و ماژولار جهت اتوماسیون کامل دریافت روزانه گزارش‌های کارکرد پرسنل از سامانه حضور و غیاب **PwKaraWeb** (پدیده‌رمزکارا) با طراحی شیشه‌ای مایع (Liquid Glass) بر پایه کتابخانه [Glisse](https://glisse.kelvinzhang.com/).

---

## ۱. حالت‌های سه‌گانه دریافت خروجی‌های روزانه (Selectable Output Modes)

در نسخه جدید، کاربر می‌تواند از میان **۳ حالت دریافت روزانه** بر اساس نیاز خود یکی را از طریق کلید چندحالته شیشه‌ای (Segmented Control) انتخاب نماید:

```text
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│       ۱. ماه مشخص        │        ۲. کل سال         │    ۳. بازه دو تاریخ     │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### حالت ۱: خروجی از یک ماه مشخص از یک سال مشخص (Specific Month)
- انتخاب سال شمسی (مثلاً `1403` یا `1405`).
- انتخاب ماه شمسی (فروردین تا اسفند).
- تعیین بازه روزها (مثلاً از روز ۱ تا ۳۰) یا فشردن دکمه **«انتخاب کل ماه»**.
- مناسب دریافت گزارش‌های ماهانه جاری سازمان.

### حالت ۲: خروجی برای کل یک سال مشخص (Entire Specified Year)
- انتخاب سال شمسی (مثلاً `1403`).
- افزونه به صورت خودکار تمامی **۳۶۵ روز** (یا **۳۶۶ روز** در سال‌های کبیسه نظیر ۱۴۰۳ و ۱۴۰۸) را در قالب ۱۲ ماه استخراج می‌کند.
- هر روز به صورت تفکیک‌شده در پوشه ماه مربوط به خود (`1403/01-Farvardin` تا `1403/12-Esfand`) ذخیره می‌گردد.
- مناسب بایگانی سالانه کارکرد کل پرسنل با یک کلیک.

### حالت ۳: خروجی بر اساس بازه زمانی بین دو تاریخ مشخص (Custom Date Range)
- تعیین دقیق تاریخ شروع: **از سال / از ماه / از روز** (مثلاً `1403/07/15`).
- تعیین دقیق تاریخ پایان: **تا سال / تا ماه / تا روز** (مثلاً `1403/09/20`).
- امکان عبور آزادانه از مرز ماه‌ها و حتی سال‌ها (مثلاً از `1402/11/20` تا `1403/02/10`).
- محاسبه خودکار تعداد دقیق روزهای موجود در بازه با رعایت طول ماه‌ها و سال‌های کبیسه.

---

## ۲. طراحی رابط کاربری شیشه‌ای مایع (Glisse Liquid Glass UI)

رابط کاربری افزونه با الهام و پیاده‌سازی مستقیم از کتابخانه **Glisse** اثر طراح و مهندس مطرح **کلوین ژانگ** ([glisse.kelvinzhang.com](https://glisse.kelvinzhang.com/)) توسعه یافته است:

- **سطوح شیشه‌ای و بازتاب نور (Liquid Glass):** کارت‌ها و پس‌زمینه با افکت تاری پیشرفته (`backdrop-filter: blur(16px) saturate(1.8)`), لبه‌های درخشان (`rim shine`), و سایه‌های انکساری ملایم طراحی شده‌اند.
- **تب‌بار و سوئیچ چندحالته مایع (`.lg-segmented`, `.lg-tab-bar`):** تغییر نرم و پویا میان حالت‌های استخراج و تب‌های تنظیمات با بازخورد فیزیکی.
- **دکمه‌های شیشه‌ای تپنده (`.lg-button`):** دکمه اصلی با گرادیان سبز اختصاصی اکسل و بازتاب مایع، همراه با حالت‌های فشرده‌شدن فیزیکی (Tactile Pressed States) و دکمه قرمز شیشه‌ای لغو عملیات (`[data-destructive]`).
- **ورودی‌های کپسولی شیشه‌ای (`.lg-input`):** فیلدهای ورودی گرد با هایلایت درونی و انکسار نور پس‌زمینه.
- **پشتیبانی بومی از راست‌به‌چین (RTL) و فونت وزیرمتن:** تجربه کاربری کاملاً فارسی و خوانا بدون وابستگی به اینترنت.

---

## ۳. پیش‌نیازها و راهنمای نصب در مرورگر کروم (Load Unpacked)

1. مرورگر گوگل کروم (نسخه 102 به بالا).
2. ورود به صفحه مدیریت افزونه‌ها:
   ```text
   chrome://extensions
   ```
3. فعال‌سازی **Developer mode** از گوشه بالا سمت راست.
4. کلیک بر روی دکمه **Load unpacked** و انتخاب پوشه پروژه.
5. افزونه با آیکون اختصاصی در نوار ابزار کروم فعال می‌شود.

---

## ۴. تنظیمات ضروری Site Settings در کروم (رفع خطای مسدودی دانلود)

به دلیل میزبانی سامانه بر روی پروتکل HTTP در شبکه سازمانی، مرورگر کروم دانلود خودکار چندین فایل متوالی را مسدود می‌کند. پیش از اولین اجرا:

1. نشانی زیر را در کروم باز کنید:
   ```text
   chrome://settings/content/siteDetails?site=http%3A%2F%2F172.26.87.8%3A8091
   ```
2. دو گزینه زیر را بر روی **Allow** قرار دهید:
   - **Automatic downloads** ⬅️ **Allow**
   - **Insecure content** ⬅️ **Allow**
3. در صورت پایداری خطای مرورگر:
   - نشانی `chrome://flags/#unsafely-treat-insecure-origin-as-secure` را باز کنید.
   - پرچم را **Enabled** نموده و مقدار `http://172.26.87.8:8091` را در کادر آن وارد کنید، سپس مرورگر را Relaunch نمایید.

---

## ۵. نحوه کار و فرآیند درخواست (Request Lifecycle)

1. سامانه کارا را در یک زبانه باز کرده و وارد صفحه گزارش کارکرد شوید:
   `http://172.26.87.8:8091/KaraReports/KarkardSummary`
2. فیلترهای دلخواه پرسنلی و اقلام گزارش را در صفحه تعیین کنید.
3. افزونه را باز کنید؛ نشانگرهای کارت عیب‌یابی (اتصال، صفحه گزارشات، توکن، دکمه اکسل) به صورت زنده وضعیت را ارزیابی می‌کنند.
4. یکی از سه حالت **ماه مشخص**، **کل سال** یا **بازه دو تاریخ** را برگزینید.
5. دکمه **«شروع دریافت گزارش‌ها»** را بزنید.

### مشخصات فنی درخواست‌ها مطابق `rule.md`:
- **متد:** POST
- **نوع محتوا:** `application/x-www-form-urlencoded`
- **نشست:** `credentials: 'include'` (ارسال امن کوکی‌های `.ASPXAUTH`)
- **فیلترهای تاریخ:** تنظیم همزمان ۴ فیلتر `StartDate`، `EndDate`، `MonthSelector1StartDateFormatted` و `MonthSelector1EndDateFormatted` برای هر روز.
- **پارامتر دستور دکمه اکسل:** `command = ایجاد جدول اکسل` (بر اساس شناسه کنترلی ۲۸).
- **فاصله زمانی (Pacing):** حداقل ۲.۰ ثانیه تأخیر بین درخواست‌های متوالی جهت جلوگیری از قطعی نشست یا فشار به سرور.
- **اعتبارسنجی پاسخ باینری:** اعتبارسنجی هدر OLE2 (`.xls`) جهت اطمینان از خروجی معتبر و جلوگیری قطعی از ذخیره صفحات خطای HTML با پسوند اکسل.

---

## ۶. قالب‌های نام‌گذاری و ساختار پوشه‌بندی فایل‌ها

### متغیرهای نام‌گذاری:
- `{year}`: سال شمسی (مثال: `1405`)
- `{month}`: ماه دو رقمی (مثال: `08`)
- `{day}`: روز دو رقمی (مثال: `12`)
- `{date}`: تاریخ کامل خط‌تیره‌دار (مثال: `1405-08-12`)
- `{prefix}`: پیشوند فایل (پیش‌فرض: `Karkard`)

### حالت‌های پوشه‌بندی در Downloads:
- **حالت ۱ (سال / ماه):** `Karkard/1405/08-Aban/Karkard_1405_08_12.xls`
- **حالت ۲ (فقط ماه):** `Karkard/1405-08/Karkard_1405_08_12.xls`
- **حالت ۳ (بدون زیرپوشه):** `Karkard/Karkard_1405_08_12.xls`

---

## ۷. آزمون‌های خودکار و بسته‌بندی انتشار (Tests & Packaging)

جهت اجرای ۲۹ آزمون خودکار بومی پروژه در محیط Node.js:

```bash
npm test
```

جهت ساخت فایل فشرده آماده انتشار در GitHub Releases:

```bash
npm run package
```

فایل آماده در مسیر `dist/pwkaraweb-excel-exporter-v1.1.0.zip` ایجاد خواهد شد.

---

## ۸. ساختار پروژه (Project Architecture)

```text
pw_kara_exstention/
│
├── manifest.json              # پیکربندی Manifest V3 کروم
├── package.json               # اطلاعات پکیج و اسکریپت‌های تست و پکیجینگ
├── LICENSE                    # پروانه انتشار متن‌باز MIT
├── README.md                  # راهنمای دوزبانه انگلیسی و فارسی
├── CHANGELOG.md               # سوابق تغییرات و نسخه‌ها
├── CONTRIBUTING.md            # راهنمای مشارکت در توسعه
├── SECURITY.md                # خط‌مشی امنیت و حفظ حریم خصوصی
│
├── .github/
│   ├── workflows/ci.yml       # پایپ‌لاین تست خودکار GitHub Actions (Node 18, 20, 22)
│   ├── ISSUE_TEMPLATE/        # قالب‌های گزارش باگ و درخواست ویژگی جدید
│   └── pull_request_template.md
│
├── background/
│   └── service-worker.js      # سرویس‌ورکر پس‌زمینه کروم
├── content/
│   └── page-detector.js       # اسکریپت محتوا جهت استخراج زنده فرم و توکن
├── modules/
│   ├── date-manager.js        # محاسبات تقویم جلالی، سال کبیسه و بازه‌های سه‌گانه
│   ├── download-manager.js    # مدیریت امن چرخه‌حیات دانلودها
│   ├── export-manager.js      # ماشین وضعیت فرآیند دریافت و تأخیرها
│   ├── filename-manager.js    # مدیریت الگوها و فیلتر کاراکترهای ممنوعه نام فایل
│   ├── folder-manager.js      # ایجاد مسیرهای نسبی پوشه‌بندی در Downloads
│   ├── form-extractor.js      # تحلیل و استخراج دکمه و فیلترهای فرم PwKaraWeb
│   ├── karaweb-client.js      # ایجاد Payload استاندارد و ارسال Fetch
│   ├── storage-manager.js     # ذخیره‌سازی ماندگار تنظیمات و تاریخچه
│   └── validation.js          # اعتبارسنجی حداقل تأخیر و فرمت باینری اکسل
│
├── styles/
│   ├── glisse.css             # کتابخانه رسمی Liquid Glass اثر کلوین ژانگ
│   ├── fonts.css              # تعاریف @font-face برای فونت وزیرمتن
│   └── popup.css              # استایل‌های چیدمان فارسی و افکت‌های شیشه‌ای
│
├── assets/
│   ├── fonts/                 # فونت‌های محلی وزیرمتن (بدون نیاز به CDN)
│   └── icons/                 # آیکون‌های رسمی افزونه در ابعاد ۱۶، ۳۲، ۴۸ و ۱۲۸
│
├── scripts/
│   └── package-extension.js   # اسکریپت تولید فایل ZIP آماده انتشار
│
└── tests/
    ├── date-manager.test.js   # تست‌های تقویم شمسی، کبیسه و بازه‌ها
    ├── export-manager.test.js # تست ماشین وضعیت و حالت‌های سه‌گانه
    ├── filename-manager.test.js
    ├── folder-manager.test.js
    ├── mock-client.test.js
    └── validation.test.js
```

</div>
