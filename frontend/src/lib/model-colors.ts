// ---------------------------------------------------------------------------
// model-colors.ts
//
// Pure functions for mapping model IDs to UI color styles.
// Shared by ModelChip, CandidateCard, and TreeMinimap.
//
// IMPORTANT: This file must remain in Tailwind's content scan path.
// All class strings must appear as complete literals (no dynamic construction)
// so Tailwind's scanner can detect and generate them.
// ---------------------------------------------------------------------------

export type ModelProvider =
  | "anthropic"
  | "grok"
  | "gemini"
  | "openai"
  | "deepseek"
  | "llama";

export function getModelProvider(modelId: string): ModelProvider {
  if (modelId.includes("anthropic")) return "anthropic";
  if (modelId.includes("grok") || modelId.includes("x-ai")) return "grok";
  if (modelId.includes("google") || modelId.includes("gemini")) return "gemini";
  if (modelId.includes("deepseek")) return "deepseek";
  if (modelId.includes("llama") || modelId.includes("meta-llama") || modelId.includes("meta/")) return "llama";
  return "openai";
}

// ---------------------------------------------------------------------------
// ModelChip styles (background + text + border pill for inline chips)
// ---------------------------------------------------------------------------

const CHIP_STYLES: Record<ModelProvider, string> = {
  anthropic:
    "bg-primary-blue-bg text-primary-blue-text border border-primary-blue-border",
  grok: "bg-grok-bg text-grok-text border border-[#c4b5fd]",
  gemini: "bg-gemini-bg text-gemini-text border border-[#fde68a]",
  openai:
    "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]",
  deepseek: "bg-deepseek-bg text-deepseek-text border border-deepseek-border",
  llama: "bg-llama-bg text-llama-text border border-llama-border",
};

export function getModelChipStyle(modelId: string): string {
  return CHIP_STYLES[getModelProvider(modelId)];
}

// ---------------------------------------------------------------------------
// Accent border — colored left stripe on CandidateCard
// ---------------------------------------------------------------------------

const ACCENT_BORDERS: Record<ModelProvider, string> = {
  anthropic: "border-l-[3px] border-l-primary-blue-border",
  grok: "border-l-[3px] border-l-[#c4b5fd]",
  gemini: "border-l-[3px] border-l-[#fde68a]",
  openai: "border-l-[3px] border-l-[var(--color-border-secondary)]",
  deepseek: "border-l-[3px] border-l-deepseek-border",
  llama: "border-l-[3px] border-l-llama-border",
};

export function getModelAccentBorder(modelId: string): string {
  return ACCENT_BORDERS[getModelProvider(modelId)];
}

// ---------------------------------------------------------------------------
// Tree pill styles — subdued brand-colored pill for unchosen rows in the
// version tree sidebar. Winner/active states use fixed green/blue overrides.
// ---------------------------------------------------------------------------

const TREE_PILL_STYLES: Record<ModelProvider, string> = {
  anthropic:
    "bg-primary-blue-bg text-primary-blue-text border border-primary-blue-border",
  grok: "bg-grok-bg text-grok-text border border-[#c4b5fd]",
  gemini: "bg-gemini-bg text-gemini-text border border-[#fde68a]",
  openai:
    "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]",
  deepseek: "bg-deepseek-bg text-deepseek-text border border-deepseek-border",
  llama: "bg-llama-bg text-llama-text border border-llama-border",
};

export function getModelTreePillStyle(modelId: string): string {
  return TREE_PILL_STYLES[getModelProvider(modelId)];
}
