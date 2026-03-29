import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");

  // Verify CSRF nonce: state param must match the nonce stored in the cookie
  const storedStateCookie = req.cookies.get("gh_oauth_state")?.value;
  let returnPath = "/";

  if (!stateParam || !storedStateCookie) {
    return NextResponse.redirect(`${origin}/?github_error=invalid_state`);
  }

  try {
    const parsed = JSON.parse(storedStateCookie) as { nonce?: string; returnUrl?: string };
    if (parsed.nonce !== stateParam) {
      return NextResponse.redirect(`${origin}/?github_error=invalid_state`);
    }
    // returnUrl was validated as same-origin in connect/route.ts
    returnPath = parsed.returnUrl ?? "/";
  } catch {
    return NextResponse.redirect(`${origin}/?github_error=invalid_state`);
  }

  const returnUrl = new URL(returnPath, origin).toString();

  // Clear the one-time state cookie
  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set("gh_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (!code) {
    return clearStateCookie(NextResponse.redirect(`${returnUrl}?github_error=auth_failed`));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return clearStateCookie(NextResponse.redirect(`${returnUrl}?github_error=not_configured`));
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

    if (tokenData.error || !tokenData.access_token) {
      return clearStateCookie(NextResponse.redirect(`${returnUrl}?github_error=token_failed`));
    }

    const response = NextResponse.redirect(returnUrl);
    clearStateCookie(response);
    response.cookies.set("gh_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch {
    return clearStateCookie(NextResponse.redirect(`${returnUrl}?github_error=token_failed`));
  }
}
