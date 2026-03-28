import { getModelChipStyle } from "@/lib/model-colors";

interface ModelChipProps {
  modelId: string;
  modelLabel: string;
  size?: "sm" | "xs";
}

export function ModelChip({ modelId, modelLabel, size = "sm" }: ModelChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center font-medium rounded-pill",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[9px] px-1 py-0.5",
        getModelChipStyle(modelId ?? ""),
      ].join(" ")}
    >
      {modelLabel ?? modelId ?? "Unknown"}
    </span>
  );
}
