import type { ModelConfig } from "@/lib/types";

export const STORAGE_KEY_PREFIX = "vyra:models:";

/**
 * Persists a project's selected model list to localStorage.
 * Keyed per-project so different projects have independent selections.
 * No-ops silently in SSR environments or when storage is unavailable.
 */
export function saveProjectModels(projectId: string, models: ModelConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${projectId}`,
      JSON.stringify(models)
    );
  } catch {
    // Silently swallow QuotaExceededError and other storage errors.
    // The worst case is the user's selection isn't persisted for this session.
  }
}

/**
 * Loads and validates a project's persisted model selection.
 *
 * We save full ModelConfig objects (id + label + provider), so restoration
 * validates structure only — no cross-reference against an external available
 * list is needed. This ensures custom/non-default models (e.g. Haiku, GPT-4o Mini)
 * are restored correctly even though they aren't in project.models defaults.
 *
 * Pass `availableModels` only when you explicitly want to filter to a known set
 * (e.g. in tests or when a known-stale entry should be dropped).
 *
 * Returns null when:
 * - running in SSR (no localStorage)
 * - nothing is saved for the project
 * - saved data is corrupt / not an array
 * - saved items are missing required ModelConfig fields
 * - the saved list was empty
 */
export function loadProjectModels(
  projectId: string,
  availableModels?: ModelConfig[]
): ModelConfig[] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  if (availableModels && availableModels.length > 0) {
    // Optional: cross-reference against a known list (used in tests)
    const availableById = new Map(availableModels.map((m) => [m.id, m]));
    const valid = (parsed as Array<{ id?: unknown }>)
      .filter((item) => typeof item?.id === "string" && availableById.has(item.id))
      .map((item) => availableById.get(item.id as string)!);
    return valid.length > 0 ? valid : null;
  }

  // Default: validate structure only (id + label + provider present and are strings)
  const valid = (
    parsed as Array<{ id?: unknown; label?: unknown; provider?: unknown }>
  ).filter(
    (item): item is ModelConfig =>
      typeof item?.id === "string" &&
      typeof item?.label === "string" &&
      typeof item?.provider === "string"
  );
  return valid.length > 0 ? valid : null;
}
