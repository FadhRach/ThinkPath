import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-elevated": "var(--paper-elevated)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-subtle": "var(--ink-subtle)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "signal-low": "var(--signal-low)",
        "signal-mid": "var(--signal-mid)",
        "signal-high": "var(--signal-high)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      fontSize: {
        "display-1": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "display-2": ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.65" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.55" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.05em" }],
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
