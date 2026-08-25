import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        foreground: "var(--color-foreground)",
        "foreground-muted": "var(--color-foreground-muted)",
        "foreground-subtle": "var(--color-foreground-subtle)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["3.25rem", { lineHeight: "1.08", letterSpacing: "0" }],
        "display-lg": ["2.75rem", { lineHeight: "1.1", letterSpacing: "0" }],
        "display": ["2.375rem", { lineHeight: "1.14", letterSpacing: "0" }],
        "heading-xl": ["2rem", { lineHeight: "1.2", letterSpacing: "0" }],
        "heading-lg": ["1.75rem", { lineHeight: "1.25", letterSpacing: "0" }],
        "heading": ["1.5rem", { lineHeight: "1.35", letterSpacing: "0" }],
        "heading-sm": ["1.125rem", { lineHeight: "1.4", letterSpacing: "0" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        "body": ["1rem", { lineHeight: "1.7" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6" }],
        "body-xs": ["0.75rem", { lineHeight: "1.5" }],
        "caption": ["0.75rem", { lineHeight: "1.5" }],
      },
      letterSpacing: {
        tighter: "0",
        tight: "0",
        normal: "0",
        wide: "0",
        wider: "0",
        widest: "0",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        "glow": "var(--shadow-glow)",
        "glow-sm": "0 0 20px rgba(34, 211, 238, 0.1)",
        "glow-lg": "0 0 60px rgba(34, 211, 238, 0.2)",
        "inner-glow": "inset 0 0 30px rgba(34, 211, 238, 0.1)",
      },
      backgroundImage: {
        "gradient-hero": "var(--gradient-hero)",
        "gradient-card": "var(--gradient-card)",
        "gradient-glow": "var(--gradient-glow)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern": "linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "60px 60px",
      },
      animation: {
        "fade-in": "fade-in 0.5s ease forwards",
        "slide-up": "slide-up 0.6s ease forwards",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
      transitionDuration: {
        "fast": "150ms",
        "base": "200ms",
        "slow": "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
