import type { WorkspaceMode } from "@/lib/types";

/**
 * Determines whether the workspace should auto-collapse after candidate
 * selection. In agent and hybrid modes, auto-selection should trigger the
 * same collapsed transition as the user clicking "Continue with this".
 *
 * - "agent":  auto-collapse when a candidate is selected
 * - "hybrid": auto-collapse when a candidate is selected (auto-selected by evaluator)
 * - "user":   never auto-collapse (user explicitly clicks "Continue with this")
 */
export function shouldAutoCollapse(
  mode: WorkspaceMode,
  selectedCandidateId: string | null
): boolean {
  if (!selectedCandidateId) return false;
  switch (mode) {
    case "agent":
    case "hybrid":
      return true;
    case "user":
      return false;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
