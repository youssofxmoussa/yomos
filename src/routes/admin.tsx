import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Ticket, Users, Activity, FileText, BookOpen, Megaphone, BarChart3, Plus, Copy, Power, LayoutDashboard, Eye, X, Printer, Trash2, Download, AlertTriangle, Save, RotateCcw,
} from "lucide-react";
import { ActivationCardArt } from "@/components/ActivationCardArt";
import { toPng } from "html-to-image";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tab = "overview" | "cards" | "students" | "sessions" | "sections" | "courses" | "analytics";

const TABS: { id: Tab; label: string; ar: string; icon: any }[] = [
  { id: "overview", label: "Overview", ar: "نظرة عامة", icon: LayoutDashboard },
  { id: "cards", label: "Cards", ar: "البطاقات", icon: Ticket },
  { id: "students", label: "Students", ar: "الطلاب", icon: Users },
  { id: "sessions", label: "Sessions", ar: "الجلسات", icon: Activity },
  { id: "sections", label: "Sections", ar: "أقسام الموقع", icon: FileText },
  { id: "courses", label: "Courses", ar: "الدورات", icon: BookOpen },
  { id: "analytics", label: "Analytics", ar: "التحليلات", icon: BarChart3 },
];

function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  if (loading || !user) return <main className="container mx-auto px-6 py-16 text-muted-foreground">…</main>;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-[calc(100vh-6rem)] fade-up">
      <div className="mb-6 sm:mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-en mb-1">Admin Control Center</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">لوحة الإدارة</h1>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 scrollbar-thin">
        <div className="inline-flex gap-1 rounded-full pill-nav p-1.5 font-en">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm whitespace-nowrap transition ${
                  active ? "bg-cream-gradient text-background font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="size-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "cards" && <CardsTab adminId={user.id} />}
      {tab === "students" && <StudentsTab />}
      {tab === "sessions" && <SessionsTab adminId={user.id} />}
      {tab === "sections" && <SectionsTab />}
      {tab === "courses" && <CoursesTab adminId={user.id} />}
      {tab === "analytics" && <AnalyticsTab />}
    </main>
  );
}

/* ============ OVERVIEW ============ */
function OverviewTab() {
  const { data: stats } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [u, c, s, cards, active] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("user_sessions").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("activation_cards").select("id", { count: "exact", head: true }),
        supabase.from("activation_cards").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return {
        users: u.count ?? 0, courses: c.count ?? 0, online: s.count ?? 0,
        cards: cards.count ?? 0, active_cards: active.count ?? 0,
      };
    },
  });

  const items = [
    { label: "إجمالي الطلاب", value: stats?.users ?? 0, en: "Students" },
    { label: "متصل الآن", value: stats?.online ?? 0, en: "Online", accent: true },
    { label: "البطاقات النشطة", value: stats?.active_cards ?? 0, en: "Active Cards" },
    { label: "إجمالي البطاقات", value: stats?.cards ?? 0, en: "Total Cards" },
    { label: "الدورات", value: stats?.courses ?? 0, en: "Courses" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {items.map((i) => (
        <div key={i.en} className={`rounded-2xl border p-5 ${i.accent ? "border-cream/30 bg-card relative overflow-hidden" : "border-border bg-card"}`}>
          {i.accent && <div className="absolute -top-10 -right-10 size-32 bg-cream/5 rounded-full blur-3xl" />}
          <div className="text-3xl sm:text-4xl font-black font-en">{i.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{i.label}</div>
          <div className="text-[10px] text-muted-foreground/60 font-en uppercase tracking-wider mt-0.5">{i.en}</div>
        </div>
      ))}
    </div>
  );
}

/* ============ CARDS ============ */
function CardsTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(10);
  const [previewCard, setPreviewCard] = useState<{ code: string; expires_at: string | null } | null>(null);
  const [confirm, setConfirm] = useState<null | { mode: "revoke" | "delete"; id: string; code: string }>(null);

  const { data: cards } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: async () => {
      const { data } = await supabase.from("activation_cards")
        .select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  async function generate() {
    const { error } = await supabase.rpc("generate_cards", { _count: count });
    if (error) return toast.error(error.message);
    toast.success(`تم إنشاء ${count} بطاقة`);
    qc.invalidateQueries({ queryKey: ["admin-cards"] });
  }

  async function doRevoke(id: string) {
    const { error } = await supabase.from("activation_cards").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم إلغاء البطاقة");
    qc.invalidateQueries({ queryKey: ["admin-cards"] });
  }
  async function doDelete(id: string) {
    // Always revoke first so any active session is invalidated, then delete the row.
    await supabase.from("activation_cards").update({ status: "revoked" }).eq("id", id);
    const { error } = await supabase.from("activation_cards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الإلغاء والحذف نهائياً");
    qc.invalidateQueries({ queryKey: ["admin-cards"] });
  }

  function exportCsv() {
    if (!cards) return;
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      "Code / كود البطاقة",
      "Status / الحالة",
      "Created At / تاريخ الإنشاء",
      "Activated At / تاريخ التفعيل",
      "Expires At / تاريخ الانتهاء",
      "Days Left / أيام متبقية",
      "Activated By / مفعّلة بواسطة",
      "Notes / ملاحظات",
    ];
    const rows = cards.map((c) => {
      const days = c.expires_at
        ? Math.max(0, Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000))
        : "";
      return [c.code, c.status, c.created_at, c.activated_at ?? "", c.expires_at ?? "", days, c.activated_by ?? "", c.notes ?? ""].map(esc).join(",");
    });
    const summary = `# Yomo Cards Export — ${new Date().toLocaleString("en-GB")}\n# Total: ${cards.length} · Active: ${cards.filter((c)=>c.status==="active").length} · Used: ${cards.filter((c)=>c.status==="used").length} · Expired: ${cards.filter((c)=>c.status==="expired").length} · Revoked: ${cards.filter((c)=>c.status==="revoked").length}\n`;
    const csv = "\uFEFF" + summary + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yomo-cards-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير ملف CSV");
  }

  const stats = {
    total: cards?.length ?? 0,
    used: cards?.filter((c) => c.status === "used").length ?? 0,
    active: cards?.filter((c) => c.status === "active").length ?? 0,
    expired: cards?.filter((c) => c.status === "expired").length ?? 0,
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-black font-en">{v}</div>
            <div className="text-xs text-muted-foreground capitalize font-en">{k}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 items-center rounded-xl border border-border bg-card p-2">
          {[1, 10, 50, 100].map((n) => (
            <button key={n} onClick={() => setCount(n)}
              className={`size-9 rounded-lg text-xs font-en transition ${count === n ? "bg-cream-gradient text-background font-bold" : "text-muted-foreground hover:bg-secondary"}`}>{n}</button>
          ))}
        </div>
        <button onClick={generate} className="flex items-center gap-2 rounded-xl bg-cream-gradient px-5 py-2.5 text-sm font-semibold text-background font-en">
          <Plus className="size-4" /> Generate {count}
        </button>
        <button onClick={exportCsv} className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-secondary transition font-en">
          Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 sticky top-0 backdrop-blur">
              <tr className="text-right text-xs text-muted-foreground">
                <th className="p-3 font-en">Code</th>
                <th className="p-3 font-en">Status</th>
                <th className="p-3">انتهاء</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {cards?.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-secondary/30 transition">
                  <td className="p-3 font-en font-mono text-xs">{c.code}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-en uppercase ${
                      c.status === "active" ? "bg-cream/20 text-cream" :
                      c.status === "used" ? "bg-secondary text-muted-foreground" :
                      "bg-muted text-muted-foreground/60"
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground font-en">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-left">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setPreviewCard({ code: c.code, expires_at: c.expires_at })}
                        className="size-8 grid place-items-center rounded-lg hover:bg-cream/15 text-muted-foreground hover:text-cream" title="عرض البطاقة"><Eye className="size-3.5" /></button>
                      <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("نُسخ"); }}
                        title="نسخ الكود"
                        className="size-8 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
                      {c.status !== "revoked" && (
                        <button onClick={() => setConfirm({ mode: "revoke", id: c.id, code: c.code })}
                          title="إلغاء البطاقة (Revoke)"
                          className="size-8 grid place-items-center rounded-lg hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400"><Power className="size-3.5" /></button>
                      )}
                      <button onClick={() => setConfirm({ mode: "delete", id: c.id, code: c.code })}
                        title="حذف نهائي"
                        className="size-8 grid place-items-center rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewCard && <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />}
      {confirm && (
        <ConfirmCardActionModal
          mode={confirm.mode}
          code={confirm.code}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.mode === "revoke") await doRevoke(confirm.id);
            else await doDelete(confirm.id);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

/* ============ CONFIRM REVOKE / DELETE ============ */
function ConfirmCardActionModal({
  mode, code, onCancel, onConfirm,
}: {
  mode: "revoke" | "delete";
  code: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isDelete = mode === "delete";
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/80 backdrop-blur-md fade-up" onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className={`size-12 rounded-2xl grid place-items-center mb-4 ${isDelete ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-400"}`}>
          {isDelete ? <Trash2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </div>
        <h3 className="text-xl font-black mb-2">
          {isDelete ? "حذف البطاقة نهائياً؟" : "إلغاء تفعيل البطاقة؟"}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          {isDelete
            ? "سيتم أولاً إلغاء البطاقة (Revoke) لقطع وصول الطالب، ثم حذفها نهائياً من قاعدة البيانات. لا يمكن التراجع."
            : "سيتم منع الطالب من استخدام هذه البطاقة فوراً. تبقى البطاقة في السجل ويمكن مراجعتها لاحقاً."}
        </p>
        <div className="rounded-xl border border-border bg-background/50 px-3 py-2 mb-5 font-en text-xs font-mono break-all">
          {code}
        </div>
        {isDelete && (
          <div className="flex items-start gap-2 text-[12px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-5">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>الحذف يتضمن عملية إلغاء (Revoke) قبله — لا حاجة لإلغاء البطاقة يدوياً.</span>
          </div>
        )}
        <div className="flex gap-2 justify-end font-en">
          <button onClick={onCancel} disabled={busy}
            className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold hover:bg-accent transition disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
            disabled={busy}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-background disabled:opacity-60 ${
              isDelete ? "bg-destructive shadow-[0_8px_24px_-8px_hsl(var(--destructive)/0.6)]" : "bg-cream-gradient shadow-cream"
            }`}>
            {busy ? "..." : isDelete ? "حذف نهائي" : "إلغاء البطاقة"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ CARD PREVIEW MODAL ============ */
function CardPreviewModal({ card, onClose }: { card: { code: string; expires_at: string | null }; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | "print" | "download">(null);
  const [scale, setScale] = useState(1);
  const expiresLabel = card.expires_at
    ? new Date(card.expires_at).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })
    : "Valid 10 months from activation";

  // Lock body scroll + ESC to close + responsive scale fitting both width & height
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // chrome (header + actions + paddings) reserved around card
      const chromeH = 260;
      const padX = w < 480 ? 28 : 56;
      const maxByW = Math.min(w - padX, 520);
      const maxByH = Math.max(180, h - chromeH);
      // card native = 420x265 (aspect ~1.585)
      const scaleW = maxByW / 420;
      const scaleH = maxByH / 265;
      setScale(Math.min(1.05, Math.max(0.5, Math.min(scaleW, scaleH))));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleDownload() {
    const node = cardRef.current;
    if (!node) return;
    setBusy("download");
    try {
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: "transparent", skipFonts: true });
      const a = document.createElement("a");
      a.href = dataUrl; a.download = `yomo-card-${card.code}.png`; a.click();
      toast.success("تم التحميل");
    } catch (e: any) {
      toast.error("تعذّر التحميل: " + (e?.message ?? "خطأ"));
    } finally { setBusy(null); }
  }

  async function handlePrint() {
    const node = cardRef.current;
    if (!node) return;
    setBusy("print");
    let iframe: HTMLIFrameElement | null = null;
    try {
      // Render the card (only) to PNG so the print job contains the card and nothing else
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, skipFonts: true });
      // Hidden iframe — print scope is the card image only, not the whole page
      iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("title", "Yomo Card Print");
      Object.assign(iframe.style, {
        position: "fixed", right: "0", bottom: "0",
        width: "1px", height: "1px", border: "0", opacity: "0", pointerEvents: "none",
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(`<!doctype html><html><head><title>Yomo Card · ${card.code}</title>
        <style>
          @page { size: 3.375in 2.125in; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #000; width: 3.375in; height: 2.125in; overflow: hidden; }
          img { width: 3.375in; height: 2.125in; display: block; object-fit: cover; }
          @media print {
            html, body { background: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style></head><body>
        <img id="card" src="${dataUrl}" />
        </body></html>`);
      doc.close();
      const img = doc.getElementById("card") as HTMLImageElement;
      const fireprint = () => {
        try {
          // Slight delay so the image renders before the print dialog opens
          setTimeout(() => {
            try {
              iframe!.contentWindow!.focus();
              iframe!.contentWindow!.print();
            } catch (err: any) {
              toast.error("تعذّر الطباعة: " + (err?.message ?? "خطأ"));
            }
          }, 120);
        } catch (err: any) {
          toast.error("تعذّر الطباعة: " + (err?.message ?? "خطأ"));
        } finally {
          setTimeout(() => iframe?.remove(), 2500);
        }
      };
      if (img.complete && img.naturalWidth > 0) fireprint();
      else {
        img.onload = fireprint;
        // Safety net in case onload never fires
        setTimeout(() => { if (iframe && iframe.isConnected) fireprint(); }, 1500);
      }
    } catch (e: any) {
      toast.error("تعذّر الطباعة: " + (e?.message ?? "خطأ"));
      iframe?.remove();
    } finally { setBusy(null); }
  }

  // Mobile: bottom-sheet anchored to bottom with ~half-screen height
  // Desktop: centered modal
  return (
    <div
      dir="ltr"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 fade-up"
      onClick={onClose}
      style={{
        background:
          "radial-gradient(120% 80% at 50% 20%, rgba(212,177,108,0.10), transparent 55%), rgba(0,0,0,0.82)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
      }}
    >
      <div
        ref={wrapRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] mx-auto rounded-[28px] p-[1.5px] bg-gradient-to-br from-cream/45 via-cream/10 to-cream/35 shadow-2xl"
        style={{
          boxShadow:
            "0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,177,108,0.08), 0 0 60px -10px rgba(212,177,108,0.18)",
        }}
      >
        <div className="relative rounded-[26px] bg-[radial-gradient(120%_80%_at_50%_0%,oklch(0.16_0_0)_0%,oklch(0.08_0_0)_60%,oklch(0.05_0_0)_100%)] px-5 sm:px-8 pt-6 sm:pt-7 pb-5 sm:pb-6 flex flex-col items-center overflow-hidden">
          {/* Ambient luxe glow */}
          <div className="pointer-events-none absolute -inset-x-10 -top-24 h-48 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.92_0.06_85/0.18),transparent_70%)]" />
          {/* Gilded grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.92 0.06 85) 1px, transparent 1px), linear-gradient(90deg, oklch(0.92 0.06 85) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            }}
          />

          {/* Header */}
          <div className="relative w-full flex items-center justify-between mb-4 sm:mb-5 z-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-en uppercase tracking-[0.28em] text-cream/70 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-cream animate-pulse" /> Yomo Card
              </span>
              <span className="text-sm sm:text-base font-black text-foreground mt-0.5">
                بطاقة التفعيل
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="size-10 rounded-full bg-secondary/80 border border-cream/15 grid place-items-center hover:bg-accent hover:border-cream/30 transition active:scale-95"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Scaled card */}
          <div className="relative z-10" style={{ width: 420 * scale, height: 265 * scale }}>
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: 420,
                height: 265,
              }}
            >
              <ActivationCardArt ref={cardRef} code={card.code} expiresLabel={expiresLabel} />
            </div>
          </div>

          {/* Action bar */}
          <div className="relative z-10 mt-5 sm:mt-6 grid grid-cols-3 gap-2.5 w-full font-en max-w-[460px]">
            <button
              onClick={() => { navigator.clipboard.writeText(card.code); toast.success("Copied"); }}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-2xl bg-secondary/80 border border-cream/10 px-2 py-3 text-xs sm:text-sm font-semibold hover:bg-accent hover:border-cream/30 transition active:scale-95 min-h-[52px]"
            >
              <Copy className="size-5 sm:size-4" /> <span>Copy</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={busy !== null}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-2xl border border-cream/30 bg-card px-2 py-3 text-xs sm:text-sm font-semibold hover:bg-secondary hover:border-cream/50 transition disabled:opacity-60 active:scale-95 min-h-[52px]"
            >
              <Download className="size-5 sm:size-4" /> <span>{busy === "download" ? "..." : "Download"}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={busy !== null}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-2xl bg-cream-gradient text-background px-2 py-3 text-xs sm:text-sm font-bold shadow-cream disabled:opacity-60 active:scale-95 min-h-[52px]"
            >
              <Printer className="size-5 sm:size-4" /> <span>{busy === "print" ? "..." : "Print"}</span>
            </button>
          </div>

          <p className="relative z-10 mt-3 text-[10.5px] text-muted-foreground/70 text-center font-en tracking-wide">
            Print uses card-only template · 3.375 × 2.125 in
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ STUDENTS ============ */
function StudentsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: students } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, short_id, is_suspended, created_at").order("created_at", { ascending: false });
      const { data: cards } = await supabase.from("activation_cards").select("activated_by, status, expires_at").not("activated_by", "is", null);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => {
        const card = cards?.find((c) => c.activated_by === p.id);
        const isAdmin = roles?.some((r) => r.user_id === p.id && r.role === "admin") ?? false;
        return { ...p, card, isAdmin };
      });
    },
  });

  async function promote(target: string) {
    if (!user) return;
    if (!confirm("ترقية هذا الحساب لأدمن؟ سيحصل على صلاحيات كاملة.")) return;
    const { error } = await supabase.rpc("promote_to_admin", { _target: target });
    if (error) return toast.error(error.message);
    toast.success("تمت الترقية");
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  async function demote(target: string) {
    if (!user) return;
    if (!confirm("إزالة صلاحيات الأدمن؟")) return;
    const { error } = await supabase.rpc("demote_from_admin", { _target: target });
    if (error) return toast.error(error.message);
    toast.success("تمت الإزالة");
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  async function toggleSuspend(target: string, suspended: boolean) {
    const verb = suspended ? "unsuspend" : "suspend";
    if (!confirm(suspended ? "إلغاء تعليق الحساب؟" : "تعليق هذا الحساب؟ سيتم إنهاء جلساته فوراً.")) return;
    const { error } = await supabase.rpc(`admin_${verb}_user` as any, { _target: target });
    if (error) return toast.error(error.message);
    toast.success(suspended ? "تم إلغاء التعليق" : "تم التعليق");
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  async function forceLogout(target: string) {
    if (!confirm("إنهاء كل جلسات هذا المستخدم؟")) return;
    const { data, error } = await supabase.rpc("admin_force_logout_user", { _target: target });
    if (error) return toast.error(error.message);
    toast.success(`تم إنهاء ${data ?? 0} جلسة`);
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
  }

  return (
    <div className="space-y-3">
      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {students?.map((s) => (
          <div key={s.id} className={`rounded-2xl border bg-card p-4 ${s.is_suspended ? "border-destructive/40 opacity-70" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate flex items-center gap-2 flex-wrap">
                  {s.full_name}
                  {s.isAdmin && <span className="rounded-full bg-cream/20 text-cream text-[9px] font-en uppercase px-1.5 py-0.5">Admin</span>}
                  {s.is_suspended && <span className="rounded-full bg-destructive/20 text-destructive text-[9px] font-en uppercase px-1.5 py-0.5">Suspended</span>}
                </div>
                <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">{s.short_id ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground font-en mt-1">
                  {s.card?.status ?? "no card"} · {s.card?.expires_at ? new Date(s.card.expires_at).toLocaleDateString() : "—"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {s.isAdmin
                ? <button onClick={() => demote(s.id)} className="rounded-lg bg-destructive/15 text-destructive px-2.5 py-1.5 text-[11px] font-semibold">Demote</button>
                : <button onClick={() => promote(s.id)} className="rounded-lg bg-cream-gradient text-background px-2.5 py-1.5 text-[11px] font-bold font-en">Make admin</button>}
              <button onClick={() => toggleSuspend(s.id, !!s.is_suspended)} className="rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-en">
                {s.is_suspended ? "Unsuspend" : "Suspend"}
              </button>
              <button onClick={() => forceLogout(s.id)} className="rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-en">Logout</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block rounded-2xl border border-border bg-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 sticky top-0 backdrop-blur text-xs text-muted-foreground">
              <tr className="text-right"><th className="p-3">الاسم</th><th className="p-3">ID</th><th className="p-3">الحالة</th><th className="p-3">انتهاء البطاقة</th><th className="p-3">الدور</th><th className="p-3 text-left">الإجراءات</th></tr>
            </thead>
            <tbody>
              {students?.map((s) => (
                <tr key={s.id} className={`border-t border-border hover:bg-secondary/30 transition ${s.is_suspended ? "opacity-60" : ""}`}>
                  <td className="p-3">
                    <div className="font-bold flex items-center gap-2">
                      {s.full_name}
                      {s.is_suspended && <span className="rounded-full bg-destructive/20 text-destructive text-[9px] font-en uppercase px-1.5 py-0.5">Suspended</span>}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground font-mono">{s.short_id ?? "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-en uppercase ${
                      s.card?.status === "active" ? "bg-cream/20 text-cream" : "bg-muted text-muted-foreground/60"
                    }`}>{s.card?.status ?? "—"}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground font-en">
                    {s.card?.expires_at ? new Date(s.card.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">
                    {s.isAdmin
                      ? <span className="rounded-full bg-cream/20 text-cream text-[10px] font-en uppercase px-2 py-0.5">Admin</span>
                      : <span className="text-[10px] text-muted-foreground/60 font-en uppercase">student</span>}
                  </td>
                  <td className="p-3 text-left">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      {s.isAdmin
                        ? <button onClick={() => demote(s.id)} className="rounded-lg bg-destructive/15 text-destructive px-2.5 py-1.5 text-[11px] font-semibold">Demote</button>
                        : <button onClick={() => promote(s.id)} className="rounded-lg bg-cream-gradient text-background px-2.5 py-1.5 text-[11px] font-bold font-en">Admin</button>}
                      <button onClick={() => toggleSuspend(s.id, !!s.is_suspended)} className="rounded-lg bg-secondary hover:bg-accent px-2.5 py-1.5 text-[11px] font-en">
                        {s.is_suspended ? "Unsuspend" : "Suspend"}
                      </button>
                      <button onClick={() => forceLogout(s.id)} className="rounded-lg bg-secondary hover:bg-accent px-2.5 py-1.5 text-[11px] font-en">Logout</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ SESSIONS ============ */
function SessionsTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("user_sessions")
        .select("*").eq("is_active", true).order("started_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((s) => s.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, short_id").in("id", ids);
      const map = new Map(profs?.map((p) => [p.id, p]) ?? []);
      return (data ?? []).map((s) => {
        const p = map.get(s.user_id);
        return { ...s, name: p?.full_name ?? s.user_id.slice(0, 8), short_id: p?.short_id ?? null };
      });
    },
    refetchInterval: 10000,
  });

  async function terminate(id: string) {
    if (!confirm("إنهاء هذه الجلسة؟")) return;
    const { error } = await supabase.rpc("terminate_session", { _session_id: id });
    if (error) return toast.error(error.message);
    toast.success("تم إنهاء الجلسة");
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-cream animate-pulse" />
        {sessions?.length ?? 0} جلسة نشطة (تحديث كل 10 ثوان)
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {sessions?.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{s.name}</div>
                <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">{s.short_id ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-1 font-en">{s.device_label}</div>
                {(s.device_brand || s.device_model) && (
                  <div className="text-[11px] text-cream/80 mt-1 font-en">
                    {[s.device_brand, s.device_model].filter(Boolean).join(" ")}
                    {s.os_name ? ` · ${s.os_name} ${s.os_version ?? ""}` : ""}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground/70 mt-2 font-en">
                  بدأ {new Date(s.created_at).toLocaleString("ar")}
                </div>
              </div>
              <button onClick={() => terminate(s.id)}
                className="rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive px-3 py-1.5 text-xs font-semibold whitespace-nowrap font-en">
                Terminate
              </button>
            </div>
          </div>
        ))}
        {!sessions?.length && <div className="text-muted-foreground text-sm">لا توجد جلسات نشطة.</div>}
      </div>
    </div>
  );
}

/* ============ SECTIONS (CMS) ============ */
function SectionsTab() {
  const qc = useQueryClient();
  const { data: sections } = useQuery({
    queryKey: ["admin-sections"],
    queryFn: async () => {
      const { data } = await supabase.from("site_sections").select("*").order("display_order");
      return data ?? [];
    },
  });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [mode, setMode] = useState<"form" | "json">("form");

  // Realtime: update list + preview when other admin saves
  useEffect(() => {
    const ch = supabase.channel("admin_sections_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_sections" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-sections"] });
        qc.invalidateQueries({ queryKey: ["site_sections"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const active = useMemo(() => sections?.find((s) => s.key === activeKey) ?? sections?.[0] ?? null, [sections, activeKey]);

  useEffect(() => {
    if (active && draft === null) setDraft(active.content);
  }, [active, draft]);

  async function save() {
    if (!active) return;
    const { error } = await supabase.from("site_sections")
      .update({ content: draft, updated_at: new Date().toISOString() }).eq("key", active.key);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ — يظهر مباشرة على الموقع");
    qc.invalidateQueries({ queryKey: ["admin-sections"] });
    qc.invalidateQueries({ queryKey: ["site_sections"] });
  }

  function reset() {
    if (!active) return;
    setDraft(active.content);
    toast.info("تم استرجاع آخر نسخة محفوظة");
  }

  if (!sections?.length) return <div className="text-muted-foreground text-sm">لا توجد أقسام.</div>;

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4">
      {/* Section list */}
      <aside className="rounded-2xl border border-border bg-card p-2 h-fit lg:sticky lg:top-24">
        {sections.map((s) => {
          const a = (active?.id === s.id);
          return (
            <button key={s.id} onClick={() => { setActiveKey(s.key); setDraft(s.content); }}
              className={`w-full text-right rounded-xl px-3 py-2.5 mb-1 transition ${
                a ? "bg-cream-gradient text-background font-bold" : "hover:bg-secondary text-foreground"
              }`}>
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-en">Section</div>
              <div className="font-en text-sm">{s.key}</div>
            </button>
          );
        })}
      </aside>

      {/* Editor + live preview */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-cream animate-pulse" />
            <span className="text-xs text-muted-foreground font-en">Live preview · realtime</span>
          </div>
          <div className="flex items-center gap-2 font-en">
            <div className="rounded-full bg-secondary p-1 text-xs flex">
              <button onClick={() => setMode("form")} className={`px-3 py-1 rounded-full transition ${mode === "form" ? "bg-cream-gradient text-background font-bold" : "text-muted-foreground"}`}>Form</button>
              <button onClick={() => setMode("json")} className={`px-3 py-1 rounded-full transition ${mode === "json" ? "bg-cream-gradient text-background font-bold" : "text-muted-foreground"}`}>JSON</button>
            </div>
            <button onClick={reset} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs hover:bg-accent transition">
              <RotateCcw className="size-3.5" /> Reset
            </button>
            <button onClick={save} className="flex items-center gap-1.5 rounded-full bg-cream-gradient text-background px-4 py-1.5 text-xs font-bold shadow-cream">
              <Save className="size-3.5" /> حفظ
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-en mb-3">Editor</div>
            {mode === "form" && active ? (
              <SectionForm sectionKey={active.key} value={draft} onChange={setDraft} />
            ) : (
              <textarea
                value={JSON.stringify(draft, null, 2)}
                onChange={(e) => { try { setDraft(JSON.parse(e.target.value)); } catch { /* ignore typing */ } }}
                rows={20}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs font-mono"
              />
            )}
          </div>
          <div className="rounded-2xl border border-cream/20 bg-background/40 p-4">
            <div className="text-[10px] uppercase tracking-wider text-cream/80 font-en mb-3">Live Preview</div>
            <SectionPreview sectionKey={active?.key ?? ""} value={draft} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Section form switcher */
function SectionForm({ sectionKey, value, onChange }: { sectionKey: string; value: any; onChange: (v: any) => void }) {
  if (!value) return null;
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });

  if (sectionKey === "hero") {
    return (
      <div className="space-y-3">
        <Field label="العنوان الرئيسي" value={value.title} onChange={(v) => set("title", v)} />
        <Field label="العنوان المميّز" value={value.title_accent} onChange={(v) => set("title_accent", v)} />
        <Field label="الوصف" value={value.subtitle} onChange={(v) => set("subtitle", v)} multiline />
      </div>
    );
  }
  if (sectionKey === "cta") {
    return (
      <div className="space-y-3">
        <Field label="العنوان" value={value.title} onChange={(v) => set("title", v)} />
        <Field label="الوصف" value={value.subtitle} onChange={(v) => set("subtitle", v)} multiline />
        <Field label="نص الزر" value={value.button_text} onChange={(v) => set("button_text", v)} />
      </div>
    );
  }
  if (sectionKey === "stats") {
    const items = (value.items ?? []) as { label: string; value: string }[];
    return (
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3">
            <Field label={`القيمة #${i + 1}`} value={it.value} onChange={(v) => { const a=[...items]; a[i]={...a[i],value:v}; set("items", a); }} />
            <Field label="الوصف" value={it.label} onChange={(v) => { const a=[...items]; a[i]={...a[i],label:v}; set("items", a); }} />
          </div>
        ))}
        <button onClick={() => set("items", [...items, { value: "0", label: "جديد" }])}
          className="w-full rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-secondary transition">
          + إضافة إحصائية
        </button>
      </div>
    );
  }
  if (sectionKey === "features") {
    const items = (value.items ?? []) as { title: string; desc: string; icon: string }[];
    return (
      <div className="space-y-3">
        <Field label="عنوان القسم" value={value.title} onChange={(v) => set("title", v)} />
        {items.map((it, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <Field label={`الميزة #${i + 1} — العنوان`} value={it.title} onChange={(v) => { const a=[...items]; a[i]={...a[i],title:v}; set("items", a); }} />
            <Field label="الوصف" value={it.desc} onChange={(v) => { const a=[...items]; a[i]={...a[i],desc:v}; set("items", a); }} multiline />
            <Field label="الأيقونة (PlayCircle / BookOpen / GraduationCap / Users)" value={it.icon} onChange={(v) => { const a=[...items]; a[i]={...a[i],icon:v}; set("items", a); }} />
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-muted-foreground">لا يوجد محرر مخصص لهذا القسم — استخدم وضع JSON.</p>;
}

function Field({ label, value, onChange, multiline }: { label: string; value: any; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground mb-1 block">{label}</span>
      {multiline ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
      )}
    </label>
  );
}

function SectionPreview({ sectionKey, value }: { sectionKey: string; value: any }) {
  if (!value) return <div className="text-xs text-muted-foreground">…</div>;
  if (sectionKey === "hero") {
    return (
      <div className="text-center py-6">
        <h1 className="text-2xl sm:text-3xl font-black leading-tight">{value.title}</h1>
        <div className="text-cream text-2xl sm:text-3xl font-black mt-1">{value.title_accent}</div>
        <p className="text-sm text-muted-foreground mt-3">{value.subtitle}</p>
      </div>
    );
  }
  if (sectionKey === "cta") {
    return (
      <div className="text-center py-6">
        <h3 className="text-xl font-black">{value.title}</h3>
        <p className="text-sm text-muted-foreground my-3">{value.subtitle}</p>
        <span className="inline-block rounded-full bg-cream-gradient text-background px-5 py-2 text-xs font-bold">{value.button_text}</span>
      </div>
    );
  }
  if (sectionKey === "stats") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {(value.items ?? []).map((s: any, i: number) => (
          <div key={i} className="rounded-xl border border-border p-3 text-right">
            <div className="text-xl font-black font-en">{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    );
  }
  if (sectionKey === "features") {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-black mb-2">{value.title}</h3>
        {(value.items ?? []).map((f: any, i: number) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <div className="font-bold text-sm">{f.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{f.desc}</div>
          </div>
        ))}
      </div>
    );
  }
  return <pre className="text-[10px] text-muted-foreground font-en overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
}

/* ============ COURSES ============ */
function CoursesTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", subject: "", grade: "", price: 0 });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("courses").insert({ ...form, instructor_id: adminId });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء الدورة");
    setShow(false); setForm({ title: "", description: "", subject: "", grade: "", price: 0 });
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  }

  async function remove(id: string) {
    if (!confirm("حذف الدورة؟")) return;
    await supabase.from("courses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  }

  return (
    <div>
      <button onClick={() => setShow(!show)} className="mb-4 flex items-center gap-2 rounded-full bg-cream-gradient px-5 py-2.5 text-sm font-semibold text-background font-en">
        <Plus className="size-4" /> دورة جديدة
      </button>
      {show && (
        <form onSubmit={create} className="mb-6 grid sm:grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-5">
          <input required placeholder="عنوان الدورة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border border-border bg-input px-3 py-2.5 sm:col-span-2" />
          <textarea placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl border border-border bg-input px-3 py-2.5 sm:col-span-2" rows={3} />
          <input placeholder="المادة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded-xl border border-border bg-input px-3 py-2.5" />
          <input placeholder="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="rounded-xl border border-border bg-input px-3 py-2.5" />
          <button className="rounded-xl bg-cream-gradient text-background py-2.5 font-semibold sm:col-span-2 font-en">حفظ</button>
        </form>
      )}
      <div className="space-y-2">
        {courses?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{c.subject} · {c.grade}</div>
              <div className="font-bold truncate">{c.title}</div>
            </div>
            <button onClick={() => remove(c.id)} className="size-9 grid place-items-center rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ ANNOUNCEMENTS ============ */
function AnnouncementsTab({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", body: "" });

  const { data: list } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert({ ...form, created_by: adminId });
    if (error) return toast.error(error.message);
    toast.success("تم البث للجميع");
    setForm({ title: "", body: "" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <div>
      <form onSubmit={send} className="rounded-2xl border border-border bg-card p-5 mb-6 space-y-3">
        <input required placeholder="عنوان الإعلان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-xl border border-border bg-input px-3 py-2.5" />
        <textarea placeholder="نص الإعلان" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="w-full rounded-xl border border-border bg-input px-3 py-2.5" rows={3} />
        <button className="rounded-full bg-cream-gradient text-background px-6 py-2.5 text-sm font-semibold font-en">بث للطلاب</button>
      </form>
      <div className="space-y-2">
        {list?.map((a) => (
          <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="font-bold">{a.title}</div>
            {a.body && <div className="text-sm text-muted-foreground mt-1">{a.body}</div>}
            <div className="text-[11px] text-muted-foreground/70 mt-2 font-en">{new Date(a.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ ANALYTICS ============ */
function AnalyticsTab() {
  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const soon = new Date(); soon.setDate(soon.getDate() + 30);
      const [expSoon, recent, totalSessions] = await Promise.all([
        supabase.from("activation_cards").select("id", { count: "exact", head: true })
          .eq("status", "active").lt("expires_at", soon.toISOString()),
        supabase.from("user_activity_log").select("event_type, created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("user_sessions").select("id", { count: "exact", head: true }),
      ]);
      return { exp_soon: expSoon.count ?? 0, recent: recent.data ?? [], total_sessions: totalSessions.count ?? 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-cream/30 bg-card p-5">
          <div className="text-xs text-muted-foreground">بطاقات تنتهي خلال 30 يوم</div>
          <div className="text-4xl font-black mt-1 font-en">{data?.exp_soon ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">إجمالي الجلسات</div>
          <div className="text-4xl font-black mt-1 font-en">{data?.total_sessions ?? 0}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold mb-4">آخر الأنشطة</h3>
        <div className="space-y-2">
          {data?.recent.map((r, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-border pb-2">
              <span className="font-en text-muted-foreground">{r.event_type}</span>
              <span className="text-xs text-muted-foreground/70 font-en">{new Date(r.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
