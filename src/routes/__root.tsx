import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import CardNav from "@/components/CardNav";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">الصفحة غير موجودة</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-cream-gradient px-5 py-2.5 text-sm font-semibold text-background">
          الرئيسية
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-cream-gradient px-5 py-2.5 text-sm font-semibold text-background">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

const SITE = "https://yomopremium.lovable.app";
const OG = `${SITE}/yomo-og.jpg`;
const DESC_AR = "Yomo منصة لبنانية فاخرة متخصصة في بكالوريا علوم الحياة (SV) بالفرنسي وإنجليزي. دروس مرئية، تمارين تفاعلية، ومراجعة منهج وزارة التربية اللبنانية الرسمي.";
const TITLE = "Yomo — منصة بكالوريا SV لبنان · فرنسي وإنجليزي";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" },
      { title: TITLE },
      { name: "description", content: DESC_AR },
      { name: "keywords", content: "بكالوريا لبنان, baccalauréat liban, SV لبنان, sciences de la vie, علوم الحياة, منصة تعليمية لبنانية, دروس بكالوريا, منهج لبناني, Yomo, يومو, مراجعة بكالوريا, امتحانات رسمية لبنان, bac sv liban, examens officiels libanais" },
      { name: "author", content: "Yomo" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow" },
      { name: "language", content: "Arabic, French" },
      { name: "geo.region", content: "LB" },
      { name: "geo.country", content: "Lebanon" },
      { name: "geo.placename", content: "Beirut, Lebanon" },
      { name: "ICBM", content: "33.8938, 35.5018" },
      { name: "distribution", content: "global" },
      { name: "rating", content: "general" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:site_name", content: "Yomo" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC_AR },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_LB" },
      { property: "og:locale:alternate", content: "fr_LB" },
      { property: "og:url", content: SITE },
      { property: "og:image", content: OG },
      { property: "og:image:secure_url", content: OG },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Yomo — منصة بكالوريا علوم الحياة في لبنان" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@yomo_lb" },
      { name: "twitter:creator", content: "@yomo_lb" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC_AR },
      { name: "twitter:image", content: OG },
      { name: "twitter:image:alt", content: "Yomo — منصة بكالوريا SV لبنان" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "msapplication-TileColor", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Yomo" },
      { name: "application-name", content: "Yomo" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/yomo-logo.png" },
      { rel: "apple-touch-icon", href: "/yomo-logo.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&family=Manrope:wght@400;500;600;700;800&display=swap" },
      { rel: "alternate", hrefLang: "ar-LB", href: SITE },
      { rel: "alternate", hrefLang: "fr-LB", href: SITE },
      { rel: "alternate", hrefLang: "x-default", href: SITE },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "EducationalOrganization",
              "@id": `${SITE}/#organization`,
              "name": "Yomo",
              "alternateName": ["يومو", "Yomo Premium"],
              "url": SITE,
              "logo": `${SITE}/yomo-logo.png`,
              "image": OG,
              "description": "منصة تعليمية لبنانية متخصصة في بكالوريا علوم الحياة (SV) بالفرنسي وإنجليزي",
              "address": { "@type": "PostalAddress", "addressCountry": "LB", "addressRegion": "Beirut" },
              "areaServed": { "@type": "Country", "name": "Lebanon" },
              "knowsLanguage": ["ar", "fr"],
              "educationalCredentialAwarded": "Baccalauréat libanais — Sciences de la Vie (SV)"
            },
            {
              "@type": "WebSite",
              "@id": `${SITE}/#website`,
              "url": SITE,
              "name": "Yomo",
              "publisher": { "@id": `${SITE}/#organization` },
              "inLanguage": ["ar-LB", "fr-LB"]
            }
          ]
        })
      }
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CardNav />
        <div className="pt-20 sm:pt-24">
          <Outlet />
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
