import { cn } from "@/lib/utils";

/** The Placid Connect mark — a gradient "D" with a price-tag counter. */
export function LogoMark({ className = "h-8 w-8", holeColor = "#ffffff" }: { className?: string; holeColor?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Placid Connect" fill="none">
      <defs>
        <linearGradient id="pc-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c81fd6" />
          <stop offset="1" stopColor="#8e2de2" />
        </linearGradient>
      </defs>
      <path
        fill="url(#pc-mark)"
        fillRule="evenodd"
        d="M9 6h12a18 18 0 0 1 0 36H9V6ZM16 13v22h5a11 11 0 0 0 0-22h-5Z"
      />
      <path
        fill="url(#pc-mark)"
        d="M30.6 15.2a2 2 0 0 1 2 2v7.6a2 2 0 0 1-.6 1.4l-8.8 8.8a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1 0-2.8l8.8-8.8a2 2 0 0 1 1.4-.6h4.2Z"
      />
      <circle cx="27.8" cy="19" r="1.9" fill={holeColor} />
    </svg>
  );
}

/** Full lockup: mark + "Placid Connect" wordmark. */
export function Logo({
  className,
  markClass = "h-8 w-8",
  textClass = "text-lg",
  dark = false,
}: {
  className?: string;
  markClass?: string;
  textClass?: string;
  dark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClass} holeColor={dark ? "#0d0a1c" : "#ffffff"} />
      <span className={cn("font-bold tracking-tight", textClass, dark ? "text-white" : "text-slate-900")}>
        Placid{" "}
        <span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">Connect</span>
      </span>
    </span>
  );
}
