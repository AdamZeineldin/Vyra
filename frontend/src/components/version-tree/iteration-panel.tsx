"use client";

import { SectionLabel } from "@/components/ui/section-label";
import { Panel } from "@/components/ui/panel";

interface IterationPanelProps {
  current: number;
  total: number;
}

function Dot({ state }: { state: "done" | "current" | "next" }) {
  const classes = {
    done: "w-2 h-2 rounded-full bg-winner",
    current: "w-2.5 h-2.5 rounded-full bg-primary-blue ring-2 ring-primary-blue-bg",
    next: "w-2 h-2 rounded-full border border-dashed border-[var(--color-border-secondary)]",
  }[state];

  return <span className={classes} />;
}

export function IterationPanel({ current, total }: IterationPanelProps) {
  const dots = Array.from({ length: Math.max(total, 3) }, (_, i) => {
    const n = i + 1;
    if (n < current) return "done" as const;
    if (n === current) return "current" as const;
    return "next" as const;
  });

  return (
    <Panel padding="sm">
      <SectionLabel className="mb-2">Iterations</SectionLabel>

      {/* Dots row */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {dots.map((state, i) => (
          <span key={i} className="flex items-center gap-1">
            <Dot state={state} />
            {i < dots.length - 1 && (
              <span className="w-3 h-px bg-[var(--color-border-tertiary)]" />
            )}
          </span>
        ))}
      </div>

      {/* Status text */}
      <p className="text-[10px] text-[var(--color-text-tertiary)]">
        {current === 0
          ? "No iterations yet"
          : `You are on iteration ${current} of ${total}`}
      </p>
    </Panel>
  );
}
