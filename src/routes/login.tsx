import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yomoLogo from "@/assets/yomo-logo.png";
import { loginSchema } from "@/lib/auth-validation";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = loginSchema.safeParse({ email, password, website });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    if (website) {
      // honeypot tripped — pretend success but do nothing
      toast.success("...");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    // log attempt (success or failure) for audit / brute-force detection
    await supabase.from("auth_attempts").insert({
      email: parsed.data.email,
      success: !error,
      reason: error?.message ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (error || !data.user) {
      setBusy(false);
      return toast.error(error?.message ?? "فشل تسجيل الدخول");
    }
    // Check role first
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
    if (roleRow?.role !== "admin") {
      const { data: ok } = await supabase.rpc("user_has_valid_card", { _user_id: data.user.id });
      if (!ok) {
        await supabase.auth.signOut();
        setBusy(false);
        return toast.error("بطاقتك منتهية أو غير مفعّلة. تواصل مع الإدارة.");
      }
    }
    setBusy(false);
    // Greet by name from profile
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
    toast.success(`مرحباً ${prof?.full_name ?? ""} 👋`);
    navigate({ to: roleRow?.role === "admin" ? "/admin" : "/dashboard" });
  }

  return (
    <main className="h-[calc(100svh-5rem)] overflow-hidden flex items-center justify-center px-6 bg-hero">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <img src={yomoLogo} alt="Yomo" className="h-20 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-3xl sm:text-4xl font-black mb-1.5 tracking-tight">مرحباً بعودتك</h1>
          <p className="text-sm text-muted-foreground">سجّل دخولك للمتابعة</p>
        </div>

        <form onSubmit={submit} className="space-y-3" autoComplete="on" noValidate>
          {/* Honeypot field — hidden from real users, bots fill it */}
          <input
            type="text" name="website" tabIndex={-1} autoComplete="off"
            value={website} onChange={(e) => setWebsite(e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />
          <div>
            <input type="email" required placeholder="البريد الإلكتروني" autoComplete="email"
              maxLength={254}
              value={email} onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-2xl border ${errors.email ? "border-destructive" : "border-border"} bg-card/40 backdrop-blur px-5 py-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cream/40 focus:bg-card/70 transition font-en`} />
            {errors.email && <p className="text-[11px] text-destructive mt-1 px-2">{errors.email}</p>}
          </div>
          <div>
            <input type="password" required placeholder="كلمة المرور" autoComplete="current-password"
              maxLength={128}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-2xl border ${errors.password ? "border-destructive" : "border-border"} bg-card/40 backdrop-blur px-5 py-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cream/40 focus:bg-card/70 transition`} />
            {errors.password && <p className="text-[11px] text-destructive mt-1 px-2">{errors.password}</p>}
          </div>
          <button disabled={busy} className="w-full rounded-2xl bg-cream-gradient px-4 py-4 text-sm font-bold text-background shadow-cream disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition mt-2">
            {busy ? "..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ليس لديك حساب؟ <Link to="/signup" className="text-foreground font-semibold hover:underline">أنشئ حساب</Link>
        </p>
      </div>
    </main>
  );
}
