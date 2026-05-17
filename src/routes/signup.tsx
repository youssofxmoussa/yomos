import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import yomoLogo from "@/assets/yomo-logo.png";
import { signupSchema, passwordStrength } from "@/lib/auth-validation";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = signupSchema.safeParse({ fullName, email, password, cardCode, website });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    if (website) { toast.success("..."); return; }
    setBusy(true);

    const code = parsed.data.cardCode;
    const { data: cardOk, error: cardErr } = await supabase
      .rpc("check_card_available", { _code: code });
    if (cardErr || !cardOk) {
      setBusy(false);
      return toast.error("بطاقة التفعيل غير موجودة أو مستخدمة");
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.fullName },
      },
    });
    if (error || !data.user) {
      setBusy(false);
      return toast.error(error?.message ?? "فشل إنشاء الحساب");
    }

    const { error: rpcErr } = await supabase.rpc("activate_card", { _code: code });
    if (rpcErr) {
      setBusy(false);
      return toast.error("تعذّر تفعيل البطاقة: " + rpcErr.message);
    }

    setBusy(false);
    toast.success(`أهلاً ${parsed.data.fullName}! تم تفعيل بطاقتك لـ 10 أشهر`);
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-[calc(100svh-5rem)] flex items-center justify-center px-6 bg-hero py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={yomoLogo} alt="Yomo" className="h-20 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-3xl sm:text-4xl font-black mb-1.5 tracking-tight">انضم إلى Yomo</h1>
          <p className="text-sm text-muted-foreground">سجّل ببطاقة تفعيل من الإدارة</p>
        </div>

        <form onSubmit={submit} className="space-y-3" autoComplete="on" noValidate>
          {/* Honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off"
            value={website} onChange={(e) => setWebsite(e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            aria-hidden="true" />
          <div>
            <input required placeholder="الاسم الكامل" autoComplete="name" maxLength={80}
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              className={`w-full rounded-2xl border ${errors.fullName ? "border-destructive" : "border-border"} bg-card/40 backdrop-blur px-5 py-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cream/40 focus:bg-card/70 transition`} />
            {errors.fullName && <p className="text-[11px] text-destructive mt-1 px-2">{errors.fullName}</p>}
          </div>
          <div>
            <input type="email" required placeholder="البريد الإلكتروني" autoComplete="email" maxLength={254}
              value={email} onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-2xl border ${errors.email ? "border-destructive" : "border-border"} bg-card/40 backdrop-blur px-5 py-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cream/40 focus:bg-card/70 transition font-en`} />
            {errors.email && <p className="text-[11px] text-destructive mt-1 px-2">{errors.email}</p>}
          </div>
          <div>
            <input type="password" required placeholder="كلمة المرور (8+ أحرف، رمز، رقم)" autoComplete="new-password" maxLength={128}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-2xl border ${errors.password ? "border-destructive" : "border-border"} bg-card/40 backdrop-blur px-5 py-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cream/40 focus:bg-card/70 transition`} />
            {password && (
              <div className="flex items-center gap-2 mt-1.5 px-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${
                    strength.score <= 1 ? "bg-destructive w-1/5" :
                    strength.score === 2 ? "bg-orange-500 w-2/5" :
                    strength.score === 3 ? "bg-yellow-500 w-3/5" :
                    "bg-green-500 w-full"
                  }`} />
                </div>
                <span className="text-[10px] text-muted-foreground">{strength.label}</span>
              </div>
            )}
            {errors.password && <p className="text-[11px] text-destructive mt-1 px-2">{errors.password}</p>}
          </div>

          <div>
            <div className="relative">
              <Ticket className="absolute right-5 top-1/2 -translate-y-1/2 size-4 text-cream/60" />
              <input required placeholder="كود بطاقة التفعيل" maxLength={19}
                value={cardCode}
                onChange={(e) => setCardCode(e.target.value.toUpperCase())}
                className={`w-full rounded-2xl border ${errors.cardCode ? "border-destructive" : "border-cream/25"} bg-card/40 backdrop-blur px-5 py-4 pr-12 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cream/50 focus:bg-card/70 transition font-en uppercase tracking-wider`} />
            </div>
            {errors.cardCode && <p className="text-[11px] text-destructive mt-1 px-2">{errors.cardCode}</p>}
          </div>

          <button disabled={busy} className="w-full rounded-2xl bg-cream-gradient px-4 py-4 text-sm font-bold text-background shadow-cream disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition mt-2">
            {busy ? "..." : "إنشاء الحساب"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          لديك حساب؟ <Link to="/login" className="text-foreground font-semibold hover:underline">سجّل الدخول</Link>
        </p>
      </div>
    </main>
  );
}
