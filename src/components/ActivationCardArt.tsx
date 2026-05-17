import { forwardRef } from "react";
import yomoLogo from "@/assets/yomo-logo.png";

interface Props {
  code: string;
  expiresLabel?: string;
}

/**
 * Branded printable activation card — luxe black + cream YoMo theme.
 * Designed at credit-card aspect ratio (3.375" x 2.125" = 1.586:1).
 */
export const ActivationCardArt = forwardRef<HTMLDivElement, Props>(
  ({ code, expiresLabel = "Valid 10 months from activation" }, ref) => {
    return (
      <div
        ref={ref}
        className="relative w-[420px] h-[265px] rounded-[22px] overflow-hidden font-en select-none"
        style={{
          background:
            "radial-gradient(ellipse at 0% 0%, oklch(0.18 0.005 90) 0%, oklch(0.07 0 0) 60%), oklch(0.07 0 0)",
          boxShadow:
            "0 30px 80px -20px rgba(0,0,0,0.8), inset 0 1px 0 0 color-mix(in oklab, oklch(0.965 0.018 85) 12%, transparent)",
          border: "1px solid color-mix(in oklab, oklch(0.965 0.018 85) 18%, transparent)",
          color: "oklch(0.965 0.018 85)",
        }}
      >
        {/* Cream glow */}
        <div
          className="absolute -top-20 -right-16 size-56 rounded-full blur-3xl pointer-events-none"
          style={{ background: "color-mix(in oklab, oklch(0.965 0.018 85) 18%, transparent)" }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.965 0.018 85) 1px, transparent 1px), linear-gradient(90deg, oklch(0.965 0.018 85) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Top row */}
        <div className="relative flex items-start justify-between px-6 pt-5">
          <div>
            <div className="text-[9px] uppercase tracking-[0.3em] opacity-60">Premium Access</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] opacity-40">Activation Card</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right leading-none">
              <div className="text-[8px] uppercase tracking-[0.25em] opacity-50">Learning</div>
            </div>
            <img src={yomoLogo} alt="Yomo" className="h-9 w-auto object-contain" />
          </div>
        </div>

        {/* Chip + accent */}
        <div className="relative px-6 mt-5 flex items-center gap-3">
          <div
            className="w-10 h-7 rounded-md"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.78 0.06 85) 0%, oklch(0.55 0.05 85) 50%, oklch(0.78 0.06 85) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)",
            }}
          />
          <div className="flex-1 h-px bg-gradient-to-r from-cream/30 to-transparent" />
        </div>

        {/* Code */}
        <div className="relative px-6 mt-3">
          <div className="text-[9px] uppercase tracking-[0.3em] opacity-50">Code</div>
          <div
            className="mt-1 font-mono font-black text-[22px] tracking-[0.18em]"
            style={{ textShadow: "0 0 24px color-mix(in oklab, oklch(0.965 0.018 85) 35%, transparent)" }}
          >
            {code}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 inset-x-6 flex items-end justify-between text-[9px]">
          <div className="opacity-60">
            <div className="uppercase tracking-[0.25em]">Valid Until</div>
            <div className="mt-0.5 opacity-90">{expiresLabel}</div>
          </div>
          <div className="opacity-50 uppercase tracking-[0.25em]">yomo.app</div>
        </div>
      </div>
    );
  },
);
ActivationCardArt.displayName = "ActivationCardArt";
