import type { WorkspaceMode } from "@/lib/types";

/**
 * Minimum confidence required for hybrid mode to auto-select.
 * At or above this value the agent takes over; below it the user decides.
 */
export const HYBRID_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Pure function — no side effects, no mutations.
 *
 * Returns true when the given mode/confidence combination should trigger
 * automatic candidate selection without waiting for user input.
 *
 * - "agent":  always auto-selects (ignores confidence)
 * - "user":   never auto-selects (always defers to user)
 * - "hybrid": auto-selects only when confidence >= HYBRID_CONFIDENCE_THRESHOLD
 */
export function shouldAutoSelect(
  mode: WorkspaceMode,
  confidence: number
): boolean {
  if (mode === "agent") return true;
  if (mode === "user") return false;
  // hybrid
  return confidence >= HYBRID_CONFIDENCE_THRESHOLD;
}
