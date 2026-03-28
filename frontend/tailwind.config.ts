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
      },
    },
  },
  plugins: [],
};
export default config;
