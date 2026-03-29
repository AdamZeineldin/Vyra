/**
 * @jest-environment jsdom
 */

import {
  saveProjectModels,
  loadProjectModels,
  STORAGE_KEY_PREFIX,
} from "@/lib/model-persistence";
import type { ModelConfig } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MODEL_A: ModelConfig = { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" };
const MODEL_B: ModelConfig = { id: "gpt-4o", label: "GPT-4o", provider: "openai" };
const MODEL_C: ModelConfig = { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" };

const ALL_MODELS: ModelConfig[] = [MODEL_A, MODEL_B, MODEL_C];

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Key format
// ---------------------------------------------------------------------------

describe("STORAGE_KEY_PREFIX", () => {
  it("is exported and is a non-empty string", () => {
    expect(typeof STORAGE_KEY_PREFIX).toBe("string");
    expect(STORAGE_KEY_PREFIX.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// saveProjectModels
// ---------------------------------------------------------------------------

describe("saveProjectModels", () => {
  it("writes serialized models to localStorage under the project key", () => {
    saveProjectModels("proj-123", [MODEL_A, MODEL_B]);
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}proj-123`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("stores the full ModelConfig objects (id, label, provider)", () => {
    saveProjectModels("proj-abc", [MODEL_A]);
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}proj-abc`);
    const parsed = JSON.parse(raw!);
    expect(parsed[0]).toEqual({ id: MODEL_A.id, label: MODEL_A.label, provider: MODEL_A.provider });
  });

  it("overwrites a previous save for the same project", () => {
    saveProjectModels("proj-1", [MODEL_A, MODEL_B]);
    saveProjectModels("proj-1", [MODEL_C]);
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}proj-1`);
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(MODEL_C.id);
  });

  it("different project IDs are stored under different keys", () => {
    saveProjectModels("proj-x", [MODEL_A]);
    saveProjectModels("proj-y", [MODEL_B]);
    const rawX = localStorage.getItem(`${STORAGE_KEY_PREFIX}proj-x`);
    const rawY = localStorage.getItem(`${STORAGE_KEY_PREFIX}proj-y`);
    expect(JSON.parse(rawX!)[0].id).toBe(MODEL_A.id);
    expect(JSON.parse(rawY!)[0].id).toBe(MODEL_B.id);
  });

  it("can save an empty array (user cleared all models)", () => {
    saveProjectModels("proj-1", []);
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}proj-1`);
    expect(JSON.parse(raw!)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadProjectModels
// ---------------------------------------------------------------------------

describe("loadProjectModels", () => {
  it("returns null when no data is saved for the project", () => {
    const result = loadProjectModels("proj-new", ALL_MODELS);
    expect(result).toBeNull();
  });

  it("returns the saved models when they all still exist in availableModels", () => {
    saveProjectModels("proj-1", [MODEL_A, MODEL_B]);
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result!.map((m) => m.id)).toEqual([MODEL_A.id, MODEL_B.id]);
  });

  it("returns full ModelConfig objects (not just IDs) sourced from availableModels", () => {
    saveProjectModels("proj-1", [MODEL_A]);
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result![0]).toEqual(MODEL_A);
  });

  it("filters out model IDs that are no longer in availableModels", () => {
    // Save with a model that has since been removed from the available list
    saveProjectModels("proj-1", [MODEL_A, { id: "old-model", label: "Old", provider: "x" }]);
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].id).toBe(MODEL_A.id);
  });

  it("returns null when ALL saved models are no longer available", () => {
    saveProjectModels("proj-1", [
      { id: "removed-1", label: "Gone 1", provider: "x" },
      { id: "removed-2", label: "Gone 2", provider: "y" },
    ]);
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result).toBeNull();
  });

  it("returns null when saved data is corrupted JSON", () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}proj-1`, "not-valid-json{{{");
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result).toBeNull();
  });

  it("returns null when saved data is not an array", () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}proj-1`, JSON.stringify({ id: "not-an-array" }));
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result).toBeNull();
  });

  it("falls through to structural validation when availableModels is empty", () => {
    // Empty availableModels => use structural path, which restores valid saved entries
    saveProjectModels("proj-1", [MODEL_A]);
    const result = loadProjectModels("proj-1", []);
    // Should restore MODEL_A since it has valid id/label/provider structure
    expect(result).not.toBeNull();
    expect(result![0].id).toBe(MODEL_A.id);
  });

  it("does not mutate the availableModels array", () => {
    saveProjectModels("proj-1", [MODEL_A]);
    const available = [...ALL_MODELS];
    const originalLength = available.length;
    loadProjectModels("proj-1", available);
    expect(available).toHaveLength(originalLength);
  });

  it("handles an empty saved array by returning null (nothing to restore)", () => {
    saveProjectModels("proj-1", []);
    const result = loadProjectModels("proj-1", ALL_MODELS);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadProjectModels — no availableModels (structural validation only)
// This is the primary usage path from workspace-shell
// ---------------------------------------------------------------------------

describe("loadProjectModels (no availableModels — structural path)", () => {
  it("restores saved models without needing an external list", () => {
    saveProjectModels("proj-1", [MODEL_A, MODEL_B]);
    const result = loadProjectModels("proj-1");
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result!.map((m) => m.id)).toEqual([MODEL_A.id, MODEL_B.id]);
  });

  it("restores non-default models (e.g. models not in project.models defaults)", () => {
    const haiku: ModelConfig = { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" };
    const miniModel: ModelConfig = { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" };
    saveProjectModels("proj-custom", [haiku, miniModel]);

    const result = loadProjectModels("proj-custom"); // no availableModels filter!
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result!.map((m) => m.id)).toEqual([haiku.id, miniModel.id]);
  });

  it("returns null for items missing required fields", () => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}proj-bad`,
      JSON.stringify([{ id: "ok" }]) // missing label and provider
    );
    const result = loadProjectModels("proj-bad");
    expect(result).toBeNull();
  });

  it("filters out items with missing fields but keeps valid ones", () => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}proj-mixed`,
      JSON.stringify([
        { id: MODEL_A.id, label: MODEL_A.label, provider: MODEL_A.provider },
        { id: "bad" }, // missing label and provider
      ])
    );
    const result = loadProjectModels("proj-mixed");
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].id).toBe(MODEL_A.id);
  });

  it("returns null when no data is saved", () => {
    expect(loadProjectModels("proj-nonexistent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Round-trip: save then load
// ---------------------------------------------------------------------------

describe("round-trip save/load", () => {
  it("correctly restores a single model (structural path)", () => {
    saveProjectModels("proj-rt", [MODEL_C]);
    const result = loadProjectModels("proj-rt");
    expect(result).toEqual([MODEL_C]);
  });

  it("correctly restores all three models (structural path)", () => {
    saveProjectModels("proj-rt", ALL_MODELS);
    const result = loadProjectModels("proj-rt");
    expect(result).toHaveLength(3);
  });

  it("project isolation: loading proj-a does not return proj-b data", () => {
    saveProjectModels("proj-a", [MODEL_A]);
    saveProjectModels("proj-b", [MODEL_B]);
    const resultA = loadProjectModels("proj-a", ALL_MODELS);
    const resultB = loadProjectModels("proj-b", ALL_MODELS);
    expect(resultA![0].id).toBe(MODEL_A.id);
    expect(resultB![0].id).toBe(MODEL_B.id);
  });
});
