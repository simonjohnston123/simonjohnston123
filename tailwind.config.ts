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
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(120deg, #c81fd6 0%, #8e2de2 100%)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
