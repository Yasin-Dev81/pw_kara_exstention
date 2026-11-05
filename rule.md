## ۱. مشخصات محیط و شبکه (Environment & Endpoint)
* نام سامانه: PwKaraWeb (سیستم حضور و غیاب و تردد)[span_0](start_span)[span_0](end_span)
* آدرس گزارش خلاصه وضعیت کارکرد: http://172.26.87.8:8091/KaraReports/KarkardSummary[span_1](start_span)[span_1](end_span)[span_2](start_span)[span_2](end_span)
* متد ارسال اطلاعات: POST[span_3](start_span)[span_3](end_span)
* نوع محتوای بدنه (Content-Type): application/x-www-form-urlencoded[span_4](start_span)[span_4](end_span)
* مدیریت نشست (Session & Auth): احراز هویت از طریق کوکی (.ASPXAUTH) و توکن ضد جعل (__RequestVerificationToken) در بدنه فرم انجام می‌شود. در درخواست‌های fetch حتماً باید credentials: 'include' قرار گیرد[span_5](start_span)[span_5](end_span)[span_6](start_span)[span_6](end_span).

---

## ۲. قوانین اجباری پارامترهای فرم (Form Payload Rules)
هر گونه تغییر در تاریخ یا درخواست خروجی اکسل، نیازمند رعایت دقیق ساختار زیر در URLSearchParams است:

1. تغییر همزمان ۴ فیلد تاریخ:
   سامانه علاوه بر دو فیلد ظاهری، دو فیلد مخفی برای کامپوننت انتخابگر ماه دارد. برای تغییر تاریخ گزارش به یک روز مشخص (با فرمت YYYY/MM/DD)، هر چهار پارامتر زیر باید به صورت همزمان مقداردهی شوند[span_7](start_span)[span_7](end_span):
   * StartDate (مثال: 1405/08/12)[span_8](start_span)[span_8](end_span)
   * EndDate (مثال: 1405/08/12)[span_9](start_span)[span_9](end_span)
   * MonthSelector1StartDateFormatted (مثال: 1405/08/12)[span_10](start_span)[span_10](end_span)
   * MonthSelector1EndDateFormatted (مثال: 1405/08/12)[span_11](start_span)[span_11](end_span)

2. حفظ وضعیت فیلترهای صفحه:
   مقادیر مربوط به توکن امنیتی و فیلترهای انتخاب‌شده توسط کاربر نباید به صورت دستی (Hardcode) نوشته شوند، بلکه باید در لحظه اجرا با استفاده از new FormData(document.querySelector('form')) از روی فرم فعال خوانده شوند[span_12](start_span)[span_12](end_span). مهم‌ترین این پارامترها عبارت‌اند از:
   * __RequestVerificationToken[span_13](start_span)[span_13](end_span)[span_14](start_span)[span_14](end_span)
   * SelectedEmployeesFiltering (فیلتر نوع استخدام/گروه پرسنل)[span_15](start_span)[span_15](end_span)
   * SelectedReportItems1InJsonFormat (آرایه JSON اقلام انتخاب‌شده گزارش)[span_16](start_span)[span_16](end_span)
   * SelectedEmployeesEmpNoInJsonFormat (لیست شماره پرسنلی افراد انتخاب‌شده)[span_17](start_span)[span_17](end_span)

3. **پارامتر تعیین نوع خروجی (command):**
   دکمه‌های عملیاتی صفحه از نوع <button type="submit" name="command"> هستند[span_18](start_span)[span_18](end_span). از آنجا که FormData به صورت پیش‌فرض مقدار دکمه کلیک‌نشده را شامل نمی‌شود، اسکریپت باید صراحتاً پارامتر دکمه هدف را به بدنه درخواست اضافه کند:
   * دکمه مشاهده: دارای ویژگی data-controlindex="27" و name="command"[span_19](start_span)[span_19](end_span)
   * دکمه ایجاد جدول اکسل: دارای ویژگی data-controlindex="28" و name="command" (مقدار value یا متن دکمه باید از DOM استخراج و در params.set('command', value) قرار گیرد)[span_20](start_span)[span_20](end_span).

---

## ۳. قوانین دانلود و نام‌گذاری فایل (File Download & Naming)
* نام‌گذاری بر اساس تاریخ: برای جلوگیری از بازنویسی فایل‌ها با نام پیش‌فرض سرور، پاسخ دریافتی از fetch باید به Blob تبدیل شده و از طریق ایجاد تگ موقت <a download="YYYY-MM-DD.xls"> با نام تاریخ همان روز ذخیره شود.
* فاصله زمانی بین درخواست‌ها (Rate Limiting): برای جلوگیری از خطای سرور یا تداخل نشست در سمت سرور، بین هر درخواست در حلقه روزهای ماه حداقل **۲ تا ۲.۵ ثانیه مکث (setTimeout)** اعمال شود.

---

## ۴. پیش‌نیازهای تنظیمات مرورگر کروم (Browser Security Rules)
به دلیل اجرای سامانه بر روی پروتکل HTTP در شبکه محلی، مرورگر کروم به صورت پیش‌فرض دانلود خودکار چند فایل را با خطای Insecure download blocked مسدود می‌کند[span_21](start_span)[span_21](end_span). پیش از اجرای اسکریپت، رعایت موارد زیر الزامی است:
[11/5/2026  3:01 PM] › 𝕐𝔸𝕊𝕀ℕ 𝕂ℍ𝕆𝕊ℍ 𝕄𝔸ℕ𝔼𝕊ℍ: 1. **در بخش Site Settings آدرس http://172.26.87.8:8091[span_22](start_span)[span_22](end_span):**
   * Automatic downloads ⬅️ تنظیم بر روی Allow
   * Insecure content ⬅️ تنظیم بر روی Allow
2. در بخش Flags مرورگر (در صورت پایداری خطا):
   * فعال‌سازی پرچم chrome://flags/#unsafely-treat-insecure-origin-as-secure و افزودن آدرس http://172.26.87.8:8091 به لیست سفید[span_23](start_span)[span_23](end_span).

---

## ۵. الگوی استاندارد کد (Reference Script)

`javascript
(async function runDailyExport() {
    const year = "1405";
    const month = "08";
    const startDay = 1;
    const endDay = 30;
    const delayMs = 2500;

    const form = document.querySelector('form');
    const excelBtn = document.querySelector('button[data-controlindex="28"]') || 
                     Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('اکسل'));

    if (!form || !excelBtn) throw new Error("Form or Excel button not found.");

    const btnName = excelBtn.getAttribute('name') || 'command';
    const btnValue = excelBtn.getAttribute('value')  excelBtn.value  excelBtn.innerText.trim();

    for (let day = startDay; day <= endDay; day++) {
        const dayStr = String(day).padStart(2, '0');
        const slashDate = `${year}/${month}/${dayStr}`;
        const fileDate = `${year}-${month}-${dayStr}`;

        const params = new URLSearchParams(new FormData(form));
        params.set(btnName, btnValue);
        params.set('StartDate', slashDate);
        params.set('EndDate', slashDate);
        params.set('MonthSelector1StartDateFormatted', slashDate);
        params.set('MonthSelector1EndDateFormatted', slashDate);

        const res = await fetch(form.action || window.location.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            credentials: 'include'
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), {
                href: url,
                download: `${fileDate}.xls`,
                style: 'display:none'
            });
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
            console.log(`Downloaded: ${fileDate}.xls`);
        } else {
            console.error(`Failed: ${fileDate} (Status: ${res.status})`);
        }

        await new Promise(r => setTimeout(r, delayMs));
    }
})();
