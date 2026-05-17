import { z } from "zod";

// Email: strict format, length cap, lowercase normalize
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "البريد الإلكتروني قصير جداً")
  .max(254, "البريد طويل جداً")
  .email("صيغة بريد غير صحيحة");

// Strong password: 8+ chars, upper, lower, digit, symbol
export const passwordSchema = z
  .string()
  .min(8, "كلمة المرور 8 أحرف على الأقل")
  .max(128, "كلمة المرور طويلة جداً")
  .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير")
  .regex(/[a-z]/, "يجب أن تحتوي على حرف صغير")
  .regex(/[0-9]/, "يجب أن تحتوي على رقم")
  .regex(/[^A-Za-z0-9]/, "يجب أن تحتوي على رمز (!@#…)");

// Full name: only letters (Arabic, Latin), spaces, hyphens, apostrophes
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "الاسم قصير جداً")
  .max(80, "الاسم طويل جداً")
  .regex(/^[\p{L}\p{M}\s'\-.]+$/u, "الاسم يحتوي على رموز غير مسموحة");

// Card code: YOMO-XXXX-XXXX-XXXX
export const cardCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^YOMO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "كود البطاقة غير صحيح");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "أدخل كلمة المرور").max(128),
  // honeypot — must be empty (bot trap)
  website: z.string().max(0, "محاولة مشبوهة").optional().or(z.literal("")),
});

export const signupSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  cardCode: cardCodeSchema,
  website: z.string().max(0).optional().or(z.literal("")),
});

// Password strength score 0-4 for UI meter
export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "قوية", "قوية جداً"];
  return { score, label: labels[score] ?? "ضعيفة" };
}
