import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UAParser } from "ua-parser-js";

export type AppRole = "admin" | "student" | "teacher";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  hasValidCard: boolean | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, role: null, hasValidCard: null, loading: true,
  signOut: async () => {},
});

type DeviceInfo = {
  label: string;
  brand: string | null;
  model: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
};

async function detectDevice(): Promise<DeviceInfo> {
  if (typeof navigator === "undefined") {
    return { label: "unknown", brand: null, model: null, os_name: null, os_version: null, browser_name: null };
  }
  const ua = navigator.userAgent;
  const parser = new UAParser(ua);
  const result = parser.getResult();

  // Try high-entropy Client Hints for brand/model on Chromium browsers
  let brand: string | null = result.device.vendor ?? null;
  let model: string | null = result.device.model ?? null;
  const uaData = (navigator as any).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues(["model", "platform", "platformVersion", "architecture"]);
      if (hints.model) model = hints.model;
      const brandList = uaData.brands?.map((b: any) => b.brand).filter((b: string) => !/Not.*Brand|Chromium/i.test(b));
      if (!brand && brandList?.length) brand = brandList[0];
    } catch {}
  }
  // Heuristic brand guess from model strings if still missing
  if (!brand && model) {
    if (/iPhone|iPad|iPod/i.test(model) || /iPhone|iPad/.test(ua)) brand = "Apple";
    else if (/Pixel/i.test(model)) brand = "Google";
    else if (/SM-|Galaxy/i.test(model)) brand = "Samsung";
    else if (/Redmi|Mi |POCO/i.test(model)) brand = "Xiaomi";
    else if (/HUAWEI|HW-|Mate |P\d{2}/i.test(model)) brand = "Huawei";
    else if (/OnePlus|OP\d/i.test(model)) brand = "OnePlus";
  }
  if (!brand) {
    if (/iPhone|iPad/.test(ua)) brand = "Apple";
    else if (/Macintosh/.test(ua)) brand = "Apple";
    else if (/Windows/.test(ua)) brand = "PC";
  }

  const os_name = result.os.name ?? null;
  const os_version = result.os.version ?? null;
  const browser_name = result.browser.name ?? null;
  const isMobile = result.device.type === "mobile" || result.device.type === "tablet" || /Mobi|Android|iPhone|iPad/i.test(ua);
  const icon = isMobile ? "📱" : "💻";
  const deviceStr = [brand, model].filter(Boolean).join(" ") || (isMobile ? "Mobile" : "Desktop");
  const osStr = [os_name, os_version].filter(Boolean).join(" ");
  const label = `${icon} ${deviceStr}${osStr ? " · " + osStr : ""}${browser_name ? " · " + browser_name : ""}`;
  return { label, brand, model, os_name, os_version, browser_name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [hasValidCard, setHasValidCard] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);

  async function fetchRoleAndCard(uid: string) {
    const [{ data: roleData }, { data: cardOk }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.rpc("user_has_valid_card", { _user_id: uid }),
      supabase.from("profiles").select("is_suspended").eq("id", uid).maybeSingle(),
    ]);
    if (profile?.is_suspended) {
      toast.error("تم تعليق حسابك. تواصل مع الإدارة.");
      await supabase.auth.signOut();
      return { role: "student" as AppRole, valid: false };
    }
    const r = (roleData?.role as AppRole) ?? "student";
    setRole(r);
    setHasValidCard(r === "admin" ? true : !!cardOk);
    return { role: r, valid: r === "admin" ? true : !!cardOk };
  }

  async function startSessionTracking(userId: string) {
    if (sessionIdRef.current) return;
    const dev = await detectDevice();
    const { data, error } = await supabase.from("user_sessions").insert({
      user_id: userId,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      device_label: dev.label,
      device_brand: dev.brand,
      device_model: dev.model,
      os_name: dev.os_name,
      os_version: dev.os_version,
      browser_name: dev.browser_name,
    }).select("id").single();
    if (!error && data) {
      sessionIdRef.current = data.id;
      await supabase.from("user_activity_log").insert({
        user_id: userId, event_type: "login",
        metadata: { device: dev.label, brand: dev.brand, model: dev.model, os: dev.os_name },
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
    }
  }

  async function endSession() {
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;
    await supabase.from("user_sessions").update({
      is_active: false, ended_at: new Date().toISOString(),
    }).eq("id", sid);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(async () => {
          const { valid } = await fetchRoleAndCard(s.user.id);
          if (event === "SIGNED_IN") {
            if (!valid) {
              toast.error("بطاقة التفعيل منتهية أو غير موجودة");
              await supabase.auth.signOut();
              return;
            }
            await startSessionTracking(s.user.id);
          }
        }, 0);
      } else {
        endSession();
        setRole(null);
        setHasValidCard(null);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await fetchRoleAndCard(data.session.user.id);
        await startSessionTracking(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Heartbeat every 60s + check if our session was terminated
  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const { data } = await supabase.from("user_sessions")
        .select("is_active").eq("id", sid).maybeSingle();
      if (data && !data.is_active) {
        toast.error("تم إنهاء جلستك من قبل الإدارة");
        sessionIdRef.current = null;
        await supabase.auth.signOut();
        return;
      }
      await supabase.from("user_sessions").update({
        last_seen_at: new Date().toISOString(),
      }).eq("id", sid);
    }, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // End session on tab close
  useEffect(() => {
    const handler = () => {
      const sid = sessionIdRef.current;
      if (sid) endSession();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session, role, hasValidCard, loading,
      signOut: async () => {
        await endSession();
        await supabase.auth.signOut();
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
