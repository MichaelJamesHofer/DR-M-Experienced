import type { Config } from "tailwindcss";

// Tailwind 3 cannot apply opacity modifiers to bare CSS-variable colors.
// Preserve the theme values while generating the intended /5, /30, etc. rules.
function themeColor(variable: string) {
  return `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`;
}

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: themeColor("--color-background"),
        surface: themeColor("--color-surface"),
        "surface-elevated": themeColor("--color-surface-elevated"),
        primary: themeColor("--color-primary"),
        "primary-hover": themeColor("--color-primary-hover"),
        accent: themeColor("--color-accent"),
        "accent-hover": themeColor("--color-accent-hover"),
        foreground: themeColor("--color-foreground"),
        "foreground-muted": themeColor("--color-foreground-muted"),
        "foreground-subtle": themeColor("--color-foreground-subtle"),
        border: themeColor("--color-border"),
        "border-strong": themeColor("--color-border-strong"),
        success: themeColor("--color-success"),
        warning: themeColor("--color-warning"),
        error: themeColor("--color-error"),
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
