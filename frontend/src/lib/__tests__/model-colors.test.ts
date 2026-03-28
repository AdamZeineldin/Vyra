import {
  getModelProvider,
  getModelChipStyle,
  getModelAccentBorder,
  getModelTreePillStyle,
} from "@/lib/model-colors";

// ---------------------------------------------------------------------------
// getModelProvider
// ---------------------------------------------------------------------------

describe("getModelProvider", () => {
  it("returns 'anthropic' for anthropic model IDs", () => {
    expect(getModelProvider("anthropic/claude-sonnet-4-5")).toBe("anthropic");
    expect(getModelProvider("anthropic/claude-3-5-haiku")).toBe("anthropic");
  });

  it("returns 'grok' for x-ai model IDs", () => {
    expect(getModelProvider("x-ai/grok-beta")).toBe("grok");
    expect(getModelProvider("grok-beta")).toBe("grok");
  });

  it("returns 'gemini' for google/gemini model IDs", () => {
    expect(getModelProvider("google/gemini-2.0-flash-001")).toBe("gemini");
    expect(getModelProvider("gemini-1.5-flash")).toBe("gemini");
  });

  it("returns 'deepseek' for deepseek model IDs", () => {
    expect(getModelProvider("deepseek/deepseek-chat")).toBe("deepseek");
    expect(getModelProvider("deepseek/deepseek-r1")).toBe("deepseek");
  });

  it("returns 'llama' for meta-llama model IDs", () => {
    expect(getModelProvider("meta-llama/llama-3.1-70b-instruct")).toBe("llama");
    expect(getModelProvider("meta/llama-3")).toBe("llama");
    expect(getModelProvider("llama-3.1-8b")).toBe("llama");
  });

  it("returns 'openai' for OpenAI model IDs", () => {
    expect(getModelProvider("openai/gpt-4o")).toBe("openai");
    expect(getModelProvider("openai/gpt-4o-mini")).toBe("openai");
  });

  it("returns 'openai' for unknown model IDs", () => {
    expect(getModelProvider("")).toBe("openai");
    expect(getModelProvider("some-unknown-model")).toBe("openai");
  });
});

// ---------------------------------------------------------------------------
// getModelChipStyle — returns Tailwind class strings
// ---------------------------------------------------------------------------

describe("getModelChipStyle", () => {
  it("returns blue classes for anthropic", () => {
    expect(getModelChipStyle("anthropic/claude-sonnet-4-5")).toContain("primary-blue");
  });

  it("returns purple/grok classes for x-ai", () => {
    expect(getModelChipStyle("x-ai/grok-beta")).toContain("grok");
  });

  it("returns yellow/gemini classes for google", () => {
    expect(getModelChipStyle("google/gemini-2.0-flash-001")).toContain("gemini");
  });

  it("returns cyan/deepseek classes for deepseek", () => {
    expect(getModelChipStyle("deepseek/deepseek-chat")).toContain("deepseek");
  });

  it("returns orange/llama classes for meta-llama", () => {
    expect(getModelChipStyle("meta-llama/llama-3.1-70b-instruct")).toContain("llama");
  });

  it("returns neutral classes for unknown or empty model", () => {
    expect(getModelChipStyle("unknown-model").length).toBeGreaterThan(0);
    expect(getModelChipStyle("").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getModelAccentBorder — returns a left-border Tailwind class
// ---------------------------------------------------------------------------

describe("getModelAccentBorder", () => {
  it("returns a non-empty string for all providers", () => {
    expect(getModelAccentBorder("anthropic/claude-sonnet-4-5").length).toBeGreaterThan(0);
    expect(getModelAccentBorder("x-ai/grok-beta").length).toBeGreaterThan(0);
    expect(getModelAccentBorder("google/gemini-2.0-flash-001").length).toBeGreaterThan(0);
    expect(getModelAccentBorder("deepseek/deepseek-chat").length).toBeGreaterThan(0);
    expect(getModelAccentBorder("meta-llama/llama-3.1-70b-instruct").length).toBeGreaterThan(0);
    expect(getModelAccentBorder("openai/gpt-4o").length).toBeGreaterThan(0);
  });

  it("returns distinct values for all 6 providers", () => {
    const values = [
      getModelAccentBorder("anthropic/claude-sonnet-4-5"),
      getModelAccentBorder("x-ai/grok-beta"),
      getModelAccentBorder("google/gemini-2.0-flash-001"),
      getModelAccentBorder("deepseek/deepseek-chat"),
      getModelAccentBorder("meta-llama/llama-3.1-70b-instruct"),
      getModelAccentBorder("openai/gpt-4o"),
    ];
    expect(new Set(values).size).toBe(6);
  });

  it("is deterministic", () => {
    expect(getModelAccentBorder("anthropic/claude-sonnet-4-5")).toBe(
      getModelAccentBorder("anthropic/claude-sonnet-4-5")
    );
  });
});

// ---------------------------------------------------------------------------
// getModelTreePillStyle — pill style for unchosen rows in the version tree
// ---------------------------------------------------------------------------

describe("getModelTreePillStyle", () => {
  it("returns a non-empty string for all providers", () => {
    expect(getModelTreePillStyle("anthropic/claude-sonnet-4-5").length).toBeGreaterThan(0);
    expect(getModelTreePillStyle("x-ai/grok-beta").length).toBeGreaterThan(0);
    expect(getModelTreePillStyle("google/gemini-2.0-flash-001").length).toBeGreaterThan(0);
    expect(getModelTreePillStyle("deepseek/deepseek-chat").length).toBeGreaterThan(0);
    expect(getModelTreePillStyle("meta-llama/llama-3.1-70b-instruct").length).toBeGreaterThan(0);
    expect(getModelTreePillStyle("openai/gpt-4o").length).toBeGreaterThan(0);
    expect(getModelTreePillStyle("").length).toBeGreaterThan(0);
  });

  it("returns distinct styles for all 6 providers", () => {
    const values = [
      getModelTreePillStyle("anthropic/claude-sonnet-4-5"),
      getModelTreePillStyle("x-ai/grok-beta"),
      getModelTreePillStyle("google/gemini-2.0-flash-001"),
      getModelTreePillStyle("deepseek/deepseek-chat"),
      getModelTreePillStyle("meta-llama/llama-3.1-70b-instruct"),
      getModelTreePillStyle("openai/gpt-4o"),
    ];
    expect(new Set(values).size).toBe(6);
  });

  it("includes brand color keyword for each provider", () => {
    expect(getModelTreePillStyle("anthropic/claude-sonnet-4-5")).toContain("primary-blue");
    expect(getModelTreePillStyle("x-ai/grok-beta")).toContain("grok");
    expect(getModelTreePillStyle("google/gemini-2.0-flash-001")).toContain("gemini");
    expect(getModelTreePillStyle("deepseek/deepseek-chat")).toContain("deepseek");
    expect(getModelTreePillStyle("meta-llama/llama-3.1-70b-instruct")).toContain("llama");
  });

  it("is deterministic", () => {
    expect(getModelTreePillStyle("deepseek/deepseek-chat")).toBe(
      getModelTreePillStyle("deepseek/deepseek-chat")
    );
    expect(getModelTreePillStyle("meta-llama/llama-3.1-70b-instruct")).toBe(
      getModelTreePillStyle("meta-llama/llama-3.1-70b-instruct")
    );
  });
});
