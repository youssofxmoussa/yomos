import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { ArrowUpRight, LogIn, UserPlus, LogOut, LayoutDashboard } from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import logoImg from "@/assets/yomo-logo.png";
import "./CardNav.css";

export default function CardNav() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => { if (isOpen) toggleMenu(); /* eslint-disable-next-line */ }, [loc.pathname]);
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const calculateHeight = () => {
    const navEl = navRef.current;
    const panel = panelRef.current;
    if (!navEl || !panel) return 280;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const topBar = isMobile ? 68 : 76;
    const prev = {
      v: panel.style.visibility, p: panel.style.pointerEvents,
      pos: panel.style.position, h: panel.style.height,
    };
    panel.style.visibility = "visible";
    panel.style.pointerEvents = "auto";
    panel.style.position = "static";
    panel.style.height = "auto";
    void panel.offsetHeight;
    const contentHeight = panel.scrollHeight;
    Object.assign(panel.style, { visibility: prev.v, pointerEvents: prev.p, position: prev.pos, height: prev.h });
    const maxAvail = window.innerHeight - 40;
    return Math.min(topBar + contentHeight + 16, maxAvail);
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const baseHeight = isMobile ? 68 : 76;
    gsap.set(navEl, { height: baseHeight, overflow: "hidden" });
    if (panelRef.current) gsap.set(panelRef.current, { y: 24, opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight, duration: 0.4, ease: "power3.out" });
    if (panelRef.current) tl.to(panelRef.current, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, "-=0.15");
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => { tl?.kill(); tlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  useLayoutEffect(() => {
    const onResize = () => {
      if (!tlRef.current) return;
      if (isExpanded) {
        gsap.set(navRef.current, { height: calculateHeight() });
        tlRef.current.kill();
        const tl = createTimeline();
        if (tl) { tl.progress(1); tlRef.current = tl; }
      } else {
        tlRef.current.kill();
        const tl = createTimeline();
        if (tl) tlRef.current = tl;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsOpen(false);
      tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const dashTo = role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="card-nav-container">
      <nav ref={navRef as any} className={`card-nav ${isExpanded ? "open" : ""}`}>
        <div className="card-nav-top">
          <div className="cn-left">
            <div
              className={`hamburger-menu ${isOpen ? "open" : ""}`}
              onClick={toggleMenu}
              role="button"
              aria-label={isExpanded ? "إغلاق القائمة" : "فتح القائمة"}
              tabIndex={0}
              style={{ color: "oklch(0.95 0.04 85)" }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMenu(); } }}
            >
              <div className="hamburger-line" />
              <div className="hamburger-line" />
            </div>
          </div>

          <Link to="/" aria-label="Yomo — الصفحة الرئيسية" className="cn-logo-wrap">
            <img src={logoImg} alt="Yomo" className="cn-logo" />
          </Link>
        </div>

        <div ref={panelRef} className="card-nav-content" aria-hidden={!isExpanded}>
          {user ? (
            <>
              <Link
                to={dashTo as any}
                onClick={() => toggleMenu()}
                className="cn-action cn-action-primary"
              >
                <span className="cn-action-icon"><LayoutDashboard className="size-5" /></span>
                <span className="cn-action-text">
                  <span className="cn-action-label">{role === "admin" ? "لوحة الإدارة" : "لوحتي"}</span>
                  <span className="cn-action-sub font-en">{role === "admin" ? "Admin Console" : "Dashboard"}</span>
                </span>
                <ArrowUpRight className="cn-action-arrow size-4" />
              </Link>
              <button
                type="button"
                onClick={() => { signOut(); toggleMenu(); }}
                className="cn-action cn-action-ghost"
              >
                <span className="cn-action-icon"><LogOut className="size-5" /></span>
                <span className="cn-action-text">
                  <span className="cn-action-label">تسجيل الخروج</span>
                  <span className="cn-action-sub font-en">Sign out</span>
                </span>
                <ArrowUpRight className="cn-action-arrow size-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signup"
                onClick={() => toggleMenu()}
                className="cn-action cn-action-primary"
              >
                <span className="cn-action-icon"><UserPlus className="size-5" /></span>
                <span className="cn-action-text">
                  <span className="cn-action-label">إنشاء حساب</span>
                  <span className="cn-action-sub font-en">Sign up · Activation card</span>
                </span>
                <ArrowUpRight className="cn-action-arrow size-4" />
              </Link>
              <Link
                to="/login"
                onClick={() => toggleMenu()}
                className="cn-action cn-action-ghost"
              >
                <span className="cn-action-icon"><LogIn className="size-5" /></span>
                <span className="cn-action-text">
                  <span className="cn-action-label">تسجيل الدخول</span>
                  <span className="cn-action-sub font-en">Log in</span>
                </span>
                <ArrowUpRight className="cn-action-arrow size-4" />
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
