import {
  shouldAutoSelect,
  HYBRID_CONFIDENCE_THRESHOLD,
} from "@/lib/mode-logic";

describe("HYBRID_CONFIDENCE_THRESHOLD", () => {
  it("is exactly 0.7", () => {
    expect(HYBRID_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});

describe("shouldAutoSelect", () => {
  // ── agent mode ──────────────────────────────────────────────────────────────

  describe("agent mode", () => {
    it("returns true when confidence is 1.0", () => {
      expect(shouldAutoSelect("agent", 1.0)).toBe(true);
    });

    it("returns true when confidence is 0.0", () => {
      expect(shouldAutoSelect("agent", 0.0)).toBe(true);
    });

    it("returns true when confidence is 0.5", () => {
      expect(shouldAutoSelect("agent", 0.5)).toBe(true);
    });

    it("returns true when confidence is below threshold", () => {
      expect(shouldAutoSelect("agent", 0.3)).toBe(true);
    });

    it("returns true when confidence is exactly the threshold", () => {
      expect(shouldAutoSelect("agent", HYBRID_CONFIDENCE_THRESHOLD)).toBe(true);
    });
  });

  // ── user mode ───────────────────────────────────────────────────────────────

  describe("user mode", () => {
    it("returns false when confidence is 1.0", () => {
      expect(shouldAutoSelect("user", 1.0)).toBe(false);
    });

    it("returns false when confidence is 0.0", () => {
      expect(shouldAutoSelect("user", 0.0)).toBe(false);
    });

    it("returns false when confidence is 0.9", () => {
      expect(shouldAutoSelect("user", 0.9)).toBe(false);
    });

    it("returns false when confidence is 0.0 (always defers to user)", () => {
      expect(shouldAutoSelect("user", 0.0)).toBe(false);
    });
  });

  // ── hybrid mode ─────────────────────────────────────────────────────────────

  describe("hybrid mode", () => {
    it("returns true when confidence equals threshold exactly (0.7)", () => {
      expect(shouldAutoSelect("hybrid", 0.7)).toBe(true);
    });

    it("returns true when confidence is above threshold (0.8)", () => {
      expect(shouldAutoSelect("hybrid", 0.8)).toBe(true);
    });

    it("returns true when confidence is 1.0", () => {
      expect(shouldAutoSelect("hybrid", 1.0)).toBe(true);
    });

    it("returns false when confidence is just below threshold (0.699)", () => {
      expect(shouldAutoSelect("hybrid", 0.699)).toBe(false);
    });

    it("returns false when confidence is 0.5", () => {
      expect(shouldAutoSelect("hybrid", 0.5)).toBe(false);
    });

    it("returns false when confidence is 0.0", () => {
      expect(shouldAutoSelect("hybrid", 0.0)).toBe(false);
    });

    it("returns false when confidence is 0.4", () => {
      expect(shouldAutoSelect("hybrid", 0.4)).toBe(false);
    });
  });

  // ── edge cases ──────────────────────────────────────────────────────────────

  describe("boundary conditions", () => {
    it("handles confidence exactly at boundary 0.7 for hybrid as auto-select", () => {
      expect(shouldAutoSelect("hybrid", HYBRID_CONFIDENCE_THRESHOLD)).toBe(true);
    });

    it("handles confidence at 0.7 for user as no auto-select", () => {
      expect(shouldAutoSelect("user", HYBRID_CONFIDENCE_THRESHOLD)).toBe(false);
    });

    it("handles confidence at 0.7 for agent as auto-select", () => {
      expect(shouldAutoSelect("agent", HYBRID_CONFIDENCE_THRESHOLD)).toBe(true);
    });

    it("all three modes produce distinct results at low confidence (0.3)", () => {
      const agent = shouldAutoSelect("agent", 0.3);
      const user = shouldAutoSelect("user", 0.3);
      const hybrid = shouldAutoSelect("hybrid", 0.3);
      expect(agent).toBe(true);
      expect(user).toBe(false);
      expect(hybrid).toBe(false);
    });

    it("agent and hybrid agree at high confidence (0.9)", () => {
      expect(shouldAutoSelect("agent", 0.9)).toBe(true);
      expect(shouldAutoSelect("hybrid", 0.9)).toBe(true);
    });
  });
});
