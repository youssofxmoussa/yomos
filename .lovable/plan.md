طلبك كبير ومتفرع — فيه ١٠ مهمات منفصلة. هون خطة منظمة قبل ما ابدأ التنفيذ، تأكد منها أو عدّل.

## 1. Modal على iPhone (iOS Safari)
- العرض: نص الشاشة عمودياً (max-h-[50vh]) على الموبايل، centered عمودياً مع `bottom-sheet` style
- اختبار على viewport 390×844 (iPhone 14) و 375×812 (iPhone X) مع screenshots
- safe-area-inset للأعلى والأسفل
- internal scroll للمحتوى لما يطول

## 2. هوية المستخدم في الجلسات
- إظهار الاسم الكامل من جدول `profiles.full_name` (اللي بينحفظ وقت signup)
- ID مخصص قصير (مثلاً `YOMO-USR-{6chars}`) بيتولد تلقائياً ويتخزن بـ `profiles.short_id`
- يبين بكل مكان: admin users list, sessions, activity log

## 3. تحسين كشف الجهاز
- استعمال User-Agent Client Hints (`navigator.userAgentData.getHighEntropyValues`) لكشف:
  - الـ brand (Samsung, Xiaomi, Huawei, Apple, etc.)
  - الـ model (iPhone 14 Pro, SM-G998, etc.)
- fallback لـ UA parsing (مكتبة `ua-parser-js` للدقة)
- يتخزن بـ `user_sessions.device_label` بصيغة: `📱 iPhone 14 Pro · iOS 17` أو `📱 Xiaomi Redmi Note 12 · Android 13`

## 4. Admin Dashboard — CMS Sections كاملة
بدي اضيف لكل sections الـ homepage إمكانية التعديل من admin:
- Hero (title, subtitle, CTA)
- Stats (الأرقام)
- Mascot section (يومو + caption)
- Features (Bento grid)
- Subjects (المواد SV)
- Pricing/CTA
- Footer
كل واحد بـ form منفصل مع preview

## 5. حذف News من Admin
- إزالة tab "Announcements/News" من admin sidebar وlogic

## 6. Analytics متقدم
صفحة جديدة `/admin/analytics`:
- **Per-user activity**: جدول كل مستخدم مع login count, last login, total time
- **Daily breakdown**: chart للـ logins/logouts يومياً (آخر 30 يوم) مع recharts
- **Device distribution**: pie chart للأجهزة المستخدمة
- **Active now**: عدد المستخدمين المتصلين حالياً
- **Top users**: الأكثر نشاطاً
- Filters: by date range, by role, by device

## 7. صلاحيات Admin أقوى
- Force logout لأي user
- Suspend/unsuspend user
- Reset password (إرسال رابط)
- Revoke card / extend card expiry
- View full audit log لكل user
- Bulk actions (delete cards, generate batch)
- Lock/unlock signup (toggle عام)

## 8. أمان قوي على Login/Signup
- **Rate limiting**: max 5 محاولات failed خلال 15 دقيقة لكل IP (server-side trigger + جدول `auth_attempts`)
- **HIBP password check** (Have I Been Pwned) — مفعّل عبر Supabase config
- **CAPTCHA** بعد 3 محاولات فاشلة (hCaptcha مجاني)
- **Zod validation** صارم: email format, password ≥ 8 chars + uppercase + number + symbol, sanitization لـ full_name
- **Card code validation** server-side فقط (موجودة بس بدها تشديد)
- **Honeypot field** ضد البوتات
- **Session fingerprinting**: ربط الـ session بـ UA + IP، لو تغيرت → force re-auth
- **CSRF**: بما إنه Supabase JWT في headers مش cookies → آمن أصلاً، بضيف origin check بالـ server functions
- اختبار: محاولة SQL injection بالـ email/password، XSS بـ full_name، brute force، session hijacking simulation

## 9. Migrations مطلوبة
```
- ALTER profiles ADD COLUMN short_id text UNIQUE
- ALTER user_sessions ADD COLUMN device_brand text, device_model text, os_name text, os_version text
- ALTER profiles ADD COLUMN is_suspended boolean DEFAULT false
- CREATE TABLE auth_attempts (ip, email, attempted_at, success)
- RPC: admin_force_logout, admin_suspend_user, admin_extend_card, get_daily_login_stats
- trigger: auto-generate short_id on profile insert
```

## 10. Dependencies جديدة
- `ua-parser-js` لكشف الأجهزة
- `recharts` للـ analytics charts (موجود غالباً)
- `@hcaptcha/react-hcaptcha` للـ CAPTCHA

## ترتيب التنفيذ (3 دفعات)
1. **Migration + Backend**: schema changes, RPCs, security triggers
2. **Frontend Auth + Modal**: signup/login validation, modal fix, screenshots على iPhone
3. **Admin overhaul**: CMS sections كاملة, analytics page, admin controls, remove news

---

⚠️ **ملاحظات مهمة قبل ما ابدأ**:
- hCaptcha بحاجة site key — إذا ما بدك CAPTCHA خارجي، بستعمل rate limiting server-side بس
- HIBP check بفعّله عبر Supabase auth config
- الـ short_id format: `YOMO-USR-XXXXXX` (6 hex chars) — مناسب؟
- بدك CMS sections يكون فيها rich text editor (Tiptap) ولا بس textarea؟ هلق هي JSON form

**وافق على الخطة أو قللي شو تعدّل، وبلش التنفيذ على دفعات.**