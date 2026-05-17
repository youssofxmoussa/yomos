import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";

export const Route = createFileRoute("/courses/$courseId")({
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses")
        .select("id, title, description, subject, grade, price, instructor_id")
        .eq("id", courseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons")
        .select("id, title, content, order_num, video_url")
        .eq("course_id", courseId).order("order_num");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", courseId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("enrollments").select("id")
        .eq("course_id", courseId).eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  async function enroll() {
    if (!user) return toast.error("سجّل الدخول أولاً");
    const { error } = await supabase.from("enrollments").insert({ course_id: courseId, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("تم التسجيل في الدورة");
    qc.invalidateQueries({ queryKey: ["enrollment", courseId, user.id] });
  }

  if (!course) return <main className="container mx-auto px-6 py-16 text-muted-foreground">جارٍ التحميل…</main>;

  return (
    <main className="container mx-auto px-6 py-12 min-h-[calc(100vh-4rem)]">
      <Link to="/courses" className="text-sm text-muted-foreground hover:text-foreground">← كل الدورات</Link>
      <div className="grid lg:grid-cols-[1fr_320px] gap-10 mt-6">
        <div>
          <div className="flex gap-2 mb-4">
            {course.subject && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{course.subject}</span>}
            {course.grade && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{course.grade}</span>}
          </div>
          <h1 className="text-4xl font-black mb-4">{course.title}</h1>
          <p className="text-muted-foreground leading-relaxed mb-10">{course.description}</p>

          <h2 className="text-xl font-bold mb-4">محتوى الدورة</h2>
          <div className="space-y-2">
            {lessons?.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                <PlayCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">{l.order_num}.</span>
                <span className="font-medium">{l.title}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 self-start rounded-2xl border border-border bg-card p-6 h-fit">
          <div className="text-3xl font-black mb-1">${Number(course.price).toFixed(0)}</div>
          <div className="text-xs text-muted-foreground mb-6">دفع لمرة واحدة</div>
          {enrollment ? (
            <div className="rounded-lg bg-secondary px-4 py-3 text-center text-sm">أنت مسجّل في هذه الدورة ✓</div>
          ) : (
            <button onClick={enroll} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-cream">
              التسجيل في الدورة
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
