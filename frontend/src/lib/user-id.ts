import type { Session } from "next-auth";

// In-memory only — reset on every page reload or tab close, so guest
// projects are never visible after the page is refreshed.
let guestId: string | null = null;

/**
 * Returns a stable user identifier for the current session.
 * - Logged-in: the user's email from their Google account.
 * - Guest: an in-memory UUID that disappears on reload or tab close.
 */
export function getUserId(session: Session | null): string {
  if (session?.user?.email) return session.user.email;

  if (typeof window === "undefined") return "unknown";

  if (!guestId) {
    guestId = crypto.randomUUID();
  }
  return guestId;
}