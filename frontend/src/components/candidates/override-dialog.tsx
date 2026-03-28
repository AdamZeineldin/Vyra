"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Candidate } from "@/lib/types";
import { ModelChip } from "./model-chip";

interface OverrideDialogProps {
  candidate: Candidate;
  onConfirm: (candidateId: string, reason: string) => void;
  onCancel: () => void;
}

export function OverrideDialog({ candidate, onConfirm, onCancel }: OverrideDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-panel p-5 w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[12px] font-medium text-[var(--color-text-primary)]">Override evaluator pick</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
              Your reason helps the evaluator learn your preferences
            </p>
          </div>
          <button onClick={onCancel} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            <X size={14} />
          </button>
        </div>

        {/* Selected model */}
        <div className="flex items-center gap-2 mb-4 p-2.5 bg-[var(--color-bg-secondary)] rounded-btn">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">Selecting:</span>
          <ModelChip modelId={candidate.modelId} modelLabel={candidate.modelLabel} />
        </div>

        {/* Reason input */}
        <label className="block text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] mb-1.5">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Cleaner structure, better variable names, more readable…"
          rows={3}
          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-btn px-3 py-2 text-[12px] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none focus:border-primary-blue transition-colors duration-fast mb-4"
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            variant="warning"
            size="sm"
            onClick={() => onConfirm(candidate.id, reason)}
          >
            Override pick
          </Button>
        </div>
      </div>
    </div>
  );
}
