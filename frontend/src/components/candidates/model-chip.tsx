interface ModelChipProps {
  modelId: string;
  modelLabel: string;
  size?: "sm" | "xs";
}

function getModelStyle(modelId: string): string {
  if (!modelId) return "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]";
  if (modelId.includes("anthropic"))
    return "bg-primary-blue-bg text-primary-blue-text border border-primary-blue-border";
  if (modelId.includes("grok") || modelId.includes("x-ai"))
    return "bg-grok-bg text-grok-text border border-[#c4b5fd]";
  if (modelId.includes("google") || modelId.includes("gemini"))
    return "bg-gemini-bg text-gemini-text border border-[#fde68a]";
  // OpenAI / default
  return "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]";
}

export function ModelChip({ modelId, modelLabel, size = "sm" }: ModelChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center font-medium rounded-pill",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[9px] px-1 py-0.5",
        getModelStyle(modelId ?? ""),
      ].join(" ")}
    >
      {modelLabel ?? modelId ?? "Unknown"}
    </span>
  );
}
