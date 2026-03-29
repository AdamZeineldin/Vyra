import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth not configured" }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const returnUrl = req.nextUrl.searchParams.get("returnUrl") ?? "/";
  const state = Buffer.from(JSON.stringify({ returnUrl })).toString("base64");
  const callbackUrl = `${origin}/api/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "repo read:user",
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}
