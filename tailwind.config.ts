import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Placid brand — magenta (#c81fd6) → purple (#8e2de2)
        brand: {
          50: "#faf2fe",
          100: "#f3e0fc",
          200: "#e6c2fa",
          300: "#d494f4",
          400: "#c05cec",
          500: "#a833e0",
          600: "#8e2de2",
          700: "#7823bd",
          800: "#631f9b",
          900: "#521c7e",
        },
        // Electric accent — the "future" pop against the magenta/purple
        accent: {
          400: "#38f0e0",
          500: "#12dcd0",
          600: "#06b6c4",
        },
        // Deep space surfaces for the dark public shell
        ink: {
          950: "#080611",
          900: "#0d0a1c",
          800: "#14102a",
          700: "#1d1740",
          600: "#2a2058",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(120deg, #c81fd6 0%, #8e2de2 100%)",
        "brand-accent": "linear-gradient(120deg, #c81fd6 0%, #8e2de2 55%, #12dcd0 130%)",
        aurora:
          "radial-gradient(60% 60% at 20% 10%, rgba(200,31,214,0.28) 0%, transparent 60%), radial-gradient(50% 50% at 85% 15%, rgba(18,220,208,0.20) 0%, transparent 55%), radial-gradient(70% 70% at 50% 100%, rgba(142,45,226,0.30) 0%, transparent 60%)",
        grid: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(200,31,214,0.25), 0 12px 40px -12px rgba(142,45,226,0.55)",
        "glow-accent": "0 0 0 1px rgba(18,220,208,0.25), 0 12px 40px -12px rgba(18,220,208,0.45)",
        soft: "0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -12px rgba(15,23,42,0.12)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(3%,-4%,0) scale(1.08)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        rise: "rise 0.7s cubic-bezier(0.22,1,0.36,1) both",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
