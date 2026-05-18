import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, subject, grade, price")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="container mx-auto px-6 py-16 min-h-[calc(100vh-4rem)]">
      <h1 className="text-4xl font-black mb-2">الدورات</h1>
      <p className="text-muted-foreground mb-10">اختر الدورة التي تناسب مرحلتك الدراسية.</p>

      {isLoading ? (
        <div className="text-muted-foreground">جارٍ التحميل…</div>
      ) : !courses?.length ? (
        <div className="text-muted-foreground">لا توجد دورات متاحة بعد.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }}
              className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition">
              <div className="flex gap-2 mb-4">
                {c.subject && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{c.subject}</span>}
                {c.grade && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{c.grade}</span>}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 group-hover:translate-x-[-2px] transition">{c.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-6">{c.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-foreground">${Number(c.price).toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">عرض الدورة ←</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
