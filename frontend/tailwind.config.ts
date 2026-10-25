import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // shadcn/ui semantic tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // ThinkPath brand + status
        brand: {
          ink: "hsl(var(--brand-ink))",
          teal: "hsl(var(--brand-teal))",
          "teal-light": "hsl(var(--brand-teal-light))",
          mint: "hsl(var(--brand-mint))",
          pink: "hsl(var(--brand-pink))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          soft: "hsl(var(--warning-soft))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          soft: "hsl(var(--danger-soft))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Judul halaman fluid (menggantikan text-[1.6rem] sm:text-[2rem] dst.), judul bagian, dan teks mikro badge.
        title: [
          "clamp(1.6rem, 1.25rem + 1.2vw, 2.1rem)",
          { lineHeight: "1.15", letterSpacing: "-0.02em" },
        ],
        heading: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        micro: ["0.6875rem", { lineHeight: "1.35", letterSpacing: "0.01em" }],
        "display-2": ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.65" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.55" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.03em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 2px 0 hsl(176 30% 20% / 0.04), 0 4px 16px -4px hsl(176 40% 20% / 0.08)",
        "soft-lg": "0 8px 32px -8px hsl(176 40% 20% / 0.12)",
      },
    },
  },
  plugins: [animate],
};

export default config;
