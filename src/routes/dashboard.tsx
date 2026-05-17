import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Calendar, Ticket, Bell } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="container mx-auto px-6 py-16 text-muted-foreground">…</main>;
  }
  if (role === "admin") return <Navigate to="/admin" />;

  return <StudentDashboard userId={user.id} email={user.email!} />;
}

function StudentDashboard({ userId, email }: { userId: string; email: string }) {
  const { data: card } = useQuery({
    queryKey: ["my-card", userId],
    queryFn: async () => {
      const { data } = await supabase.from("activation_cards")
        .select("code, status, activated_at, expires_at")
        .eq("activated_by", userId).maybeSingle();
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["my-enrollments", userId],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments")
        .select("id, courses(id, title, subject, grade)").eq("user_id", userId);
      return data ?? [];
    },
  });

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements")
        .select("id, title, body, created_at").eq("active", true)
        .order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const daysLeft = card?.expires_at ?
    Math.max(0, Math.ceil((new Date(card.expires_at).getTime() - Date.now()) / 86400000)) : null;

  return (
    <main className="container mx-auto px-5 sm:px-6 py-8 sm:py-12 min-h-[calc(100vh-6rem)] fade-up">
      <div className="mb-8 sm:mb-10 min-w-0">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-en mb-1">Student Dashboard</div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight break-all sm:break-normal">أهلاً، <span className="font-en text-muted-foreground text-base sm:text-2xl">{email}</span></h1>
      </div>

      {/* Card status */}
      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
        <div className="rounded-2xl border border-cream/20 bg-card p-5 sm:col-span-2 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 size-40 bg-cream/5 rounded-full blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Ticket className="size-3.5" /> بطاقة التفعيل
              </div>
              <div className="font-en text-lg sm:text-xl font-bold tracking-wider">{card?.code ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-2">
                مفعلة منذ {card?.activated_at ? new Date(card.activated_at).toLocaleDateString("ar") : "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black font-en">{daysLeft ?? "—"}</div>
              <div className="text-xs text-muted-foreground">يوم متبقي</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <BookOpen className="size-3.5" /> الدورات
          </div>
          <div className="text-3xl font-black font-en">{enrollments?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-2">دورة مسجّلة</div>
        </div>
      </div>

      {/* Announcements */}
      {!!announcements?.length && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Bell className="size-4" /> الإعلانات</h2>
          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="font-bold">{a.title}</div>
                {a.body && <div className="text-sm text-muted-foreground mt-1">{a.body}</div>}
                <div className="text-[11px] text-muted-foreground/70 mt-2 font-en">
                  {new Date(a.created_at).toLocaleDateString("ar")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My courses */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Calendar className="size-4" /> دوراتي</h2>
        {!enrollments?.length ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground mb-4">لم تنضم إلى أي دورة بعد.</p>
            <Link to="/courses" className="inline-block rounded-full bg-cream-gradient px-6 py-2.5 text-sm font-semibold text-background font-en">
              تصفح الدورات
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {enrollments.map((e: any) => e.courses && (
              <Link key={e.id} to="/courses/$courseId" params={{ courseId: e.courses.id }}
                className="rounded-2xl border border-border bg-card p-5 hover:border-cream/30 transition">
                <div className="text-xs text-muted-foreground mb-1">{e.courses.subject} · {e.courses.grade}</div>
                <div className="font-bold">{e.courses.title}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
