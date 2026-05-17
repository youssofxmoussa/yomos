import logoImg from "@/assets/yomo-logo.png";
import { Link } from "@tanstack/react-router";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  asLink?: boolean;
}

export function Logo({ size, className = "", asLink = true }: LogoProps) {
  // Responsive by default: bigger on mobile, controlled on desktop.
  // Pass a numeric `size` only when you need a fixed pixel height.
  const img = (
    <img
      src={logoImg}
      alt="Yomo — منصة التعلم اللبنانية الفاخرة"
      style={size ? { height: size, width: "auto" } : undefined}
      className={`object-contain select-none ${
        size ? "" : "h-12 sm:h-11 md:h-12 w-auto"
      } ${className}`}
      draggable={false}
    />
  );
  if (!asLink) return img;
  return (
    <Link to="/" aria-label="Yomo — الصفحة الرئيسية" className="inline-flex items-center">
      {img}
    </Link>
  );
}

export default Logo;
