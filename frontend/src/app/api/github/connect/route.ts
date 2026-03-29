import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth not configured" }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  // Only allow same-origin paths to prevent open redirect
  const rawReturn = req.nextUrl.searchParams.get("returnUrl") ?? "/";
  const safeReturnUrl = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/";

  // Generate a random nonce as the state parameter (CSRF protection)
  const nonce = crypto.randomUUID();
  const callbackUrl = `${origin}/api/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "public_repo read:user",
    state: nonce,
  });

  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );

  // Store nonce + returnUrl in a short-lived httpOnly cookie for callback verification
  response.cookies.set(
    "gh_oauth_state",
    JSON.stringify({ nonce, returnUrl: safeReturnUrl }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes — enough for OAuth round-trip
    }
  );

  return response;
}
