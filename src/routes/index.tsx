import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen, GraduationCap, PlayCircle, Users, ArrowLeft, Sparkles,
  ShieldCheck, Clock, Globe2, Star, Quote, ChevronDown, Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import sectionStudent from "@/assets/section-student.jpg";
import sectionMethod from "@/assets/section-method.jpg";
import sectionTutoring from "@/assets/section-tutoring.jpg";
import yomoLogo from "@/assets/yomo-logo.png";
import mascot from "@/assets/yomo-mascot.png";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => {
    const SITE = "https://yomopremium.lovable.app";
    const TITLE = "Yomo — منصة بكالوريا علوم الحياة (SV) في لبنان · فرنسي وإنجليزي";
    const DESC = "Yomo: منصة لبنانية متخصصة في بكالوريا علوم الحياة (SV). دروس مرئية بالفرنسي وإنجليزي حسب منهج وزارة التربية اللبنانية الرسمي. ابدأ بطاقتك الآن.";
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESC },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESC },
        { property: "og:url", content: SITE },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESC },
      ],
      links: [{ rel: "canonical", href: SITE }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            "name": "بكالوريا علوم الحياة (SV) — لبنان",
            "description": "دورة شاملة لمنهج البكالوريا اللبنانية في علوم الحياة (Sciences de la Vie) بالفرنسي وإنجليزي حسب وزارة التربية اللبنانية.",
            "provider": {
              "@type": "EducationalOrganization",
              "name": "Yomo",
              "sameAs": SITE,
            },
            "inLanguage": ["ar-LB", "fr-LB"],
            "educationalLevel": "Secondary / Baccalauréat",
            "availableLanguage": ["Arabic", "French"],
            "hasCourseInstance": {
              "@type": "CourseInstance",
              "courseMode": "online",
              "inLanguage": ["ar", "fr"],
              "courseWorkload": "PT200H",
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "كيف بحصل على بطاقة التفعيل؟", "acceptedAnswer": { "@type": "Answer", "text": "بتتواصل مع إدارة Yomo وبيعطوك بطاقة بكود يبدأ بـ YOMO-. البطاقة بتفعّل حسابك لمدة 10 شهور كاملة." }},
              { "@type": "Question", "name": "هل المنهج متوافق مع وزارة التربية اللبنانية؟", "acceptedAnswer": { "@type": "Answer", "text": "نعم، 100%. كل دوراتنا مبنيّة على المنهج الرسمي لبكالوريا علوم الحياة (SV) في لبنان." }},
              { "@type": "Question", "name": "بأي لغة بقدر أدرس بكالوريا SV؟", "acceptedAnswer": { "@type": "Answer", "text": "متوفّر بالفرنسي وإنجليزي — تختار اللغة اللي بترتاح فيها لكل مادة." }},
              { "@type": "Question", "name": "بقدر أستعمل حسابي من أكتر من جهاز؟", "acceptedAnswer": { "@type": "Answer", "text": "نعم، بس بمراقبة من الإدارة لضمان الأمان." }},
              { "@type": "Question", "name": "شو بيصير لما تنتهي البطاقة؟", "acceptedAnswer": { "@type": "Answer", "text": "بتقدر تجدّدها مع الإدارة وتستفيد من خصم الولاء. حسابك وكل تقدّمك بيضلّوا محفوظين." }},
            ],
          }),
        },
      ],
    };
  },
});

const ICONS: Record<string, any> = { PlayCircle, BookOpen, GraduationCap, Users };

function Index() {
  const qc = useQueryClient();
  const { data: sections } = useQuery({
    queryKey: ["site_sections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_sections")
        .select("key, content, display_order").order("display_order");
      if (error) throw error;
      return Object.fromEntries(data.map((s) => [s.key, s.content as any]));
    },
  });

  // Realtime CMS — homepage updates instantly when admin edits site_sections
  useEffect(() => {
    const ch = supabase
      .channel("site_sections_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_sections" }, () => {
        qc.invalidateQueries({ queryKey: ["site_sections"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const hero = sections?.hero ?? {};
  const stats = sections?.stats?.items ?? [];
  const features = sections?.features ?? {};
  const cta = sections?.cta ?? {};

  return (
    <main className="bg-hero overflow-hidden">
      {/* HERO — pushed down from navbar */}
      <section className="container mx-auto px-5 sm:px-6 pt-28 sm:pt-40 pb-28 sm:pb-36 text-center fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-card/40 backdrop-blur px-4 py-1.5 mb-7 sm:mb-9 text-[11px] sm:text-xs text-muted-foreground">
          <Sparkles className="size-3 text-cream" />
          منصة Yomo · للطلاب اللبنانيين
        </div>
        <h1 className="text-[2.7rem] leading-[1.04] sm:text-6xl md:text-7xl font-black text-foreground text-balance tracking-tight">
          {hero.title || "تعلّم بطريقتك"}
          <span className="block mt-1 sm:mt-2 text-cream">
            {hero.title_accent || "في أي وقت وأي مكان"}
          </span>
        </h1>
        <p className="mx-auto mt-6 sm:mt-7 max-w-xl text-[15px] sm:text-lg text-muted-foreground text-balance leading-relaxed px-2">
          {hero.subtitle || "منصة لبنانية متخصصة في بكالوريا علوم الحياة (SV) — بالفرنسي وإنجليزي، حسب منهج وزارة التربية."}
        </p>
        <div className="mt-9 sm:mt-11 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto">
          <Link to="/signup"
            className="rounded-full bg-cream-gradient px-7 py-3.5 text-[15px] font-bold text-background shadow-cream hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2">
            ابدأ الآن <ArrowLeft className="size-4" />
          </Link>
          <Link to="/courses"
            className="rounded-full border border-border bg-card/40 backdrop-blur px-7 py-3.5 text-[15px] font-bold text-foreground hover:bg-secondary transition">
            تصفح الدورات
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-20 sm:mt-24 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
          {stats.map((s: any, i: number) => (
            <div key={s.label} className="glow-border rounded-2xl border border-border bg-card/60 backdrop-blur p-4 sm:p-5 text-right" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-en">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT YOMO — split editorial */}
      <section className="container mx-auto px-5 sm:px-6 pb-28 sm:pb-36">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-14 items-center">
          <div className="order-2 lg:order-1">
            <div className="text-xs uppercase tracking-[0.25em] text-cream/70 mb-4 font-en">About Yomo</div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-6">
              منصّة لبنانية<br />
              <span className="text-cream">لجيل يستحق الأفضل</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed text-[15px] sm:text-lg mb-7">
              Yomo صُمِّمت خصّيصاً للطالب اللبناني المتجّه لبكالوريا علوم الحياة (SV) — منهج رسمي،
              دروس مرئية مرتّبة بأناقة، وتمارين تفاعليّة بالفرنسي وإنجليزي. كل شي بمكان واحد.
            </p>
            <ul className="space-y-3">
              {[
                "متوافق 100% مع منهج وزارة التربية اللبنانية",
                "بكالوريا علوم الحياة (SV) — فرنسي + إنجليزي",
                "دروس مرئية + تمارين + امتحانات سابقة",
                "متابعة شخصيّة وتقارير دوريّة لتقدّمك",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm sm:text-base">
                  <div className="mt-1 size-5 rounded-full bg-cream/15 grid place-items-center shrink-0">
                    <Check className="size-3 text-cream" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 lg:order-2 relative">
            {/* Ambient glow halo */}
            <div className="absolute -inset-8 bg-cream/[0.06] rounded-[48px] blur-3xl pointer-events-none" />
            {/* Luxe gilded frame */}
            <div className="relative rounded-[32px] p-[1.5px] bg-gradient-to-br from-cream/40 via-cream/10 to-cream/30 shadow-elevated">
              <div className="relative rounded-[30px] overflow-hidden aspect-[4/5] bg-[radial-gradient(120%_80%_at_50%_15%,oklch(0.18_0_0)_0%,oklch(0.09_0_0)_60%,oklch(0.06_0_0)_100%)] grid place-items-end justify-items-center">
                {/* Static spotlight */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.92_0.06_85/0.18),transparent_70%)] pointer-events-none" />
                {/* Subtle grid texture */}
                <div
                  className="absolute inset-0 opacity-[0.06] pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(oklch(0.92 0.06 85) 1px, transparent 1px), linear-gradient(90deg, oklch(0.92 0.06 85) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                    maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                  }}
                />
                {/* Fixed mascot — no floating animation */}
                <img
                  src={mascot}
                  alt="طالب Yomo — تعلّم كل يوم"
                  loading="lazy"
                  width={896}
                  height={1152}
                  className="relative z-10 w-[92%] max-w-[420px] object-contain object-bottom drop-shadow-[0_40px_60px_rgba(0,0,0,0.65)] pb-1"
                />
                {/* Caption chip — top-left */}
                <div className="absolute top-5 left-5 rounded-2xl border border-cream/25 bg-background/70 backdrop-blur-md px-3.5 py-2 shadow-xl z-20 max-w-[58%]">
                  <div className="text-[10px] text-cream font-en uppercase tracking-[0.2em] flex items-center gap-1.5 mb-0.5">
                    <span className="size-1.5 rounded-full bg-cream animate-pulse" /> Live
                  </div>
                  <div className="text-[12.5px] sm:text-sm font-bold leading-snug text-foreground">
                    يومو لتدرس<br />كل يوم بيومو
                  </div>
                </div>
                {/* Active students chip — bottom */}
                <div className="absolute bottom-5 right-5 left-5 flex items-center justify-between gap-2 rounded-2xl bg-background/80 backdrop-blur-md border border-cream/20 px-3.5 py-2.5 z-20 shadow-2xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={yomoLogo} alt="" className="h-7 w-auto object-contain shrink-0" />
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="text-[11px] text-cream/80 font-en uppercase tracking-[0.16em]">Active</span>
                      <span className="text-[12.5px] font-black truncate">+2,400 طالب نشط</span>
                    </div>
                  </div>
                  <div className="flex -space-x-1.5 shrink-0">
                    {[0,1,2].map((i) => (
                      <span key={i} className="size-6 rounded-full border-2 border-background bg-cream-gradient grid place-items-center text-[9px] font-black text-background font-en">
                        {["A","M","S"][i]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY LEBANESE STUDENTS — 3 pillars over image */}
      <section className="relative py-24 sm:py-32 mb-4">
        <div className="absolute inset-0">
          <img src={sectionMethod} alt="" loading="lazy" width={1280} height={896}
            className="size-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/85 to-background" />
        </div>
        <div className="relative container mx-auto px-5 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
            <div className="text-xs uppercase tracking-[0.25em] text-cream/70 mb-3 font-en">Why Yomo</div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              مصمَّمة للنجاح<br /><span className="text-cream">بطريقة لبنانيّة</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
            {[
              { icon: GraduationCap, title: "منهج SV رسمي", desc: "كل الدروس متوافقة 100% مع منهج بكالوريا علوم الحياة في لبنان والامتحانات الرسميّة." },
              { icon: ShieldCheck, title: "محتوى مدقّق", desc: "دروس مرتّبة، تمارين محلولة، وامتحانات سابقة من السنوات الماضية بكافة المواد." },
              { icon: Globe2, title: "فرنسي + إنجليزي", desc: "تختار اللغة اللي ترتاح فيها — فرنسي أو إنجليزي — بدون أي عوائق." },
            ].map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="glow-border rounded-3xl border border-border bg-card/70 backdrop-blur p-7 hover:border-cream/40 transition group" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="size-12 rounded-2xl bg-cream-gradient grid place-items-center text-background mb-5 group-hover:scale-110 transition-transform">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-black mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 4 steps */}
      <section className="container mx-auto px-5 sm:px-6 py-24 sm:py-32">
        <div className="text-center mb-14">
          <div className="text-xs uppercase tracking-[0.25em] text-cream/70 mb-3 font-en">How it works</div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">كيف بتشتغل Yomo</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: "01", title: "احصل على بطاقتك", desc: "بطاقة YOMO مفعّلة من الإدارة لمدة 10 شهور." },
            { n: "02", title: "أنشئ حسابك", desc: "اسم، إيميل، كلمة سر، وكود البطاقة. ثوانٍ معدودة." },
            { n: "03", title: "اختر دورتك", desc: "كل المواد للصف تبعك بضغطة واحدة." },
            { n: "04", title: "ابدأ التعلّم", desc: "دروس مرئية، تمارين، ومتابعة دوريّة." },
          ].map((s) => (
            <div key={s.n} className="relative rounded-3xl border border-border bg-card p-6 hover:border-cream/30 transition overflow-hidden group">
              <div className="absolute -top-2 -left-2 text-[80px] sm:text-[100px] font-black text-cream/[0.06] font-en leading-none select-none group-hover:text-cream/10 transition">{s.n}</div>
              <div className="relative">
                <div className="text-xs text-cream/70 font-en mb-3">STEP {s.n}</div>
                <div className="text-lg font-black mb-1.5">{s.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TUTORING — full-width image with overlay copy */}
      <section className="relative py-24 sm:py-32 my-4">
        <div className="container mx-auto px-5 sm:px-6">
          <div className="relative rounded-[28px] sm:rounded-[40px] overflow-hidden border border-border shadow-elevated">
            <img src={sectionTutoring} alt="غرفة دراسة فاخرة" loading="lazy" width={1280} height={896}
              className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-background/95 via-background/80 to-background/30" />
            <div className="relative p-8 sm:p-16 md:p-20 max-w-2xl">
              <div className="text-xs uppercase tracking-[0.25em] text-cream/80 mb-4 font-en">Self-paced learning</div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-5">
                ادرس وقت ما بدك<br />
                <span className="text-cream">بالفرنسي أو الإنجليزي</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed text-[15px] sm:text-lg mb-7 max-w-md">
                كل دروس بكالوريا علوم الحياة (SV) — Sciences de la Vie — بالفرنسي
                والإنجليزي. متوفّرة بأي وقت وبأي جهاز.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/courses" className="rounded-full bg-cream-gradient px-6 py-3 text-sm font-bold text-background shadow-cream font-en flex items-center gap-2">
                  تصفّح الدورات <Clock className="size-4" />
                </Link>
                <Link to="/signup" className="rounded-full border border-cream/30 bg-card/40 backdrop-blur px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition">
                  أنشئ حساب
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES from CMS */}
      <section className="container mx-auto px-5 sm:px-6 py-20 sm:py-24">
        <h2 className="text-3xl sm:text-5xl font-black text-center mb-14 sm:mb-16 tracking-tight">
          {features.title || "كل ما تحتاجه للتفوق"}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {(features.items ?? []).map((f: any) => {
            const Icon = ICONS[f.icon] ?? PlayCircle;
            return (
              <div key={f.title} className="group relative rounded-2xl border border-border bg-card p-6 hover:border-cream/30 transition overflow-hidden">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 shimmer transition-opacity" />
                <div className="size-11 rounded-xl bg-secondary grid place-items-center mb-5">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="container mx-auto px-5 sm:px-6 py-20 sm:py-28">
        <div className="text-center mb-14">
          <div className="text-xs uppercase tracking-[0.25em] text-cream/70 mb-3 font-en">Stories</div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">طلاب بيحكوا عنّا</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {[
            { name: "كارلا ع.", grade: "بكالوريا علوم عامة · بيروت", quote: "Yomo غيّرت طريقة دراستي للرياضيات. أوّل مرة بفهم الفيزياء بهالعمق. الأساتذة فعلاً فاهمين شو عم يعملوا." },
            { name: "محمد ك.", grade: "بريفيه · صيدا", quote: "أحلى شي إنّو كل الدروس متوفّرة وقت ما بدّي. صرت أرتاح وأنام عدل قبل الامتحانات بدل ما ضل ساهر." },
            { name: "ريا ح.", grade: "بكالوريا أدبية · جونية", quote: "اللغة العربية والفلسفة صاروا متعتي. الأستاذ بيشرح متل ما عم يحكي معك وجهاً لوجه. منصّة فعلاً فاخرة." },
          ].map((t) => (
            <div key={t.name} className="rounded-3xl border border-border bg-card p-7 relative overflow-hidden hover:border-cream/30 transition">
              <Quote className="absolute top-5 left-5 size-7 text-cream/15" />
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-cream text-cream" />
                ))}
              </div>
              <p className="text-sm sm:text-[15px] leading-relaxed mb-6 text-foreground/90">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="size-10 rounded-full bg-cream-gradient grid place-items-center text-background font-black">
                  {t.name[0]}
                </div>
                <div>
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.grade}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FAQSection />

      {/* CTA */}
      <section className="container mx-auto px-5 sm:px-6 pb-24 sm:pb-32 pt-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card relative overflow-hidden p-8 sm:p-14 text-center">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 size-72 bg-cream/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 right-0 size-60 bg-cream/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/5 px-3 py-1 mb-5 text-[11px] text-cream font-en">
              <Sparkles className="size-3" /> Limited seats
            </div>
            <h3 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">{cta.title || "جاهز تبدأ رحلتك؟"}</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              {cta.subtitle || "انضم لآلاف الطلاب اللبنانيين اللي بيدرسوا على Yomo اليوم."}
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-cream-gradient px-8 py-4 text-sm font-bold text-background shadow-cream font-en">
              {cta.button_text || "إنشاء حساب"} <ArrowLeft className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src={yomoLogo} alt="Yomo" className="h-10 w-auto object-contain" loading="lazy" />
        </div>
        © 2026 Yomo · جميع الحقوق محفوظة · صُنعت في لبنان
      </footer>
    </main>
  );
}

function FAQSection() {
  const faqs = [
    { q: "كيف بحصل على بطاقة التفعيل؟", a: "بتتواصل مع إدارة Yomo وبيعطوك بطاقة بكود يبدأ بـ YOMO-. البطاقة بتفعّل حسابك لمدة 10 شهور كاملة." },
    { q: "هل المنهج متوافق مع وزارة التربية اللبنانية؟", a: "نعم، 100%. كل دوراتنا مبنيّة على المنهج الرسمي للبريفيه والبكالوريا بكافة الفروع." },
    { q: "بأي لغة بقدر أدرس؟", a: "بكالوريا علوم الحياة (SV) متوفّرة بالفرنسي والإنجليزي فقط. اختر اللغة اللي بترتاح فيها لكل درس." },
    { q: "بقدر أستعمل حسابي من أكتر من جهاز؟", a: "نعم، بس بمراقبة من الإدارة لضمان الأمان. كل الجلسات بتظهر للإدارة بإمكانهم إنهاؤها لو لاحظوا أي مخالفة." },
    { q: "شو بيصير لما تنتهي البطاقة؟", a: "بتقدر تجدّدها مع الإدارة وتستفيد من خصم الولاء. حسابك وكل تقدّمك بيضلّوا محفوظين." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="container mx-auto px-5 sm:px-6 py-20 sm:py-28">
      <div className="text-center mb-12">
        <div className="text-xs uppercase tracking-[0.25em] text-cream/70 mb-3 font-en">FAQ</div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight">أسئلة بتسألها كتير</h2>
      </div>
      <div className="max-w-2xl mx-auto space-y-2.5">
        {faqs.map((f, i) => (
          <button key={i} onClick={() => setOpen(open === i ? null : i)}
            className={`w-full text-right rounded-2xl border p-5 transition ${open === i ? "border-cream/40 bg-card" : "border-border bg-card/60 hover:border-cream/20"}`}>
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-[15px] sm:text-base">{f.q}</span>
              <ChevronDown className={`size-4 shrink-0 text-cream transition-transform ${open === i ? "rotate-180" : ""}`} />
            </div>
            {open === i && (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
