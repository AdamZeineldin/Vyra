import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic backgrounds (CSS var-based)
        "bg-primary": "var(--color-bg-primary)",
        "bg-secondary": "var(--color-bg-secondary)",
        "bg-tertiary": "var(--color-bg-tertiary)",
        "bg-info": "var(--color-bg-info)",
        // Extra semantic bg
        "bg-elevated": "var(--color-bg-elevated)",
        "border-primary": "var(--color-border-primary)",
        // Status accents — dark mode tuned
        winner: "#22c55e",
        "winner-text": "#4ade80",
        "winner-bg": "#052e16",
        "winner-border": "#166534",
        "primary-blue": "#3b82f6",
        "primary-blue-text": "#93c5fd",
        "primary-blue-bg": "#1e3a5f",
        "primary-blue-border": "#1d4ed8",
        "warning-border": "#7f1d1d",
        "warning-bg": "#1c0a0a",
        "warning-text": "#f87171",
        // Diff colors — dark mode
        "diff-add-bg": "#052e16",
        "diff-add-text": "#4ade80",
        "diff-warn-bg": "#1c1a05",
        "diff-warn-text": "#fbbf24",
        "diff-del-bg": "#1c0a0a",
        "diff-del-text": "#f87171",
        // Model-specific chips — dark mode
        "grok-bg": "#1e1030",
        "grok-text": "#c084fc",
        "gemini-bg": "#1a1800",
        "gemini-text": "#fbbf24",
        "openai-bg": "#0a1f0a",
        "openai-text": "#4ade80",
        "claude-bg": "#1e1a10",
        "claude-text": "#fb923c",
        // DeepSeek — cyan/teal
        "deepseek-bg": "#001418",
        "deepseek-text": "#22d3ee",
        "deepseek-border": "#0e7490",
        // Meta Llama — orange
        "llama-bg": "#1a0f00",
        "llama-text": "#fb923c",
        "llama-border": "#92400e",
      },
      borderRadius: {
        shell: "12px",
        panel: "8px",
        btn: "6px",
        pill: "9999px",
        node: "4px",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["13px", { lineHeight: "20px" }],
      },
      transitionDuration: {
        fast: "120ms",
        smooth: "280ms",
        slow: "400ms",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
        snap: "cubic-bezier(0.2, 0, 0, 1)",
      },
      keyframes: {
        "vyra-slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "60%": { opacity: "1", transform: "translateY(-2px) scale(1.005)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "vyra-scale-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "vyra-fill": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        "vyra-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)" },
          "50%": { boxShadow: "0 0 12px 2px rgba(59, 130, 246, 0.15)" },
        },
      },
      animation: {
        "slide-up": "vyra-slide-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "vyra-scale-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        fill: "vyra-fill 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        glow: "vyra-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
