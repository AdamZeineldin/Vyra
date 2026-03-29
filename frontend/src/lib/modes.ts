import type { WorkspaceMode } from "./types";

export const MODES: { id: WorkspaceMode; label: string; description: string }[] = [
  { id: "user",   label: "User",   description: "You pick the winner" },
  { id: "hybrid", label: "Hybrid", description: "AI recommends, you decide" },
  { id: "agent",  label: "Agent",  description: "AI picks automatically" },
];
