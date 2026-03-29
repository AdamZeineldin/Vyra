import { shouldAutoCollapse } from "@/lib/collapse-logic";

describe("shouldAutoCollapse", () => {
  it("returns true in agent mode when a candidate is selected", () => {
    expect(shouldAutoCollapse("agent", "c1")).toBe(true);
  });

  it("returns false in agent mode when no candidate is selected", () => {
    expect(shouldAutoCollapse("agent", null)).toBe(false);
  });

  it("returns false in user mode even when a candidate is selected", () => {
    expect(shouldAutoCollapse("user", "c1")).toBe(false);
  });

  it("returns false in user mode when no candidate is selected", () => {
    expect(shouldAutoCollapse("user", null)).toBe(false);
  });

  it("returns true in hybrid mode when a candidate is selected", () => {
    expect(shouldAutoCollapse("hybrid", "c1")).toBe(true);
  });

  it("returns false in hybrid mode when no candidate is selected", () => {
    expect(shouldAutoCollapse("hybrid", null)).toBe(false);
  });
});
