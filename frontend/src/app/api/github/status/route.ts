import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface GitHubUser {
  login: string;
  avatar_url: string;
}

export async function GET() {
  const token = cookies().get("gh_token")?.value;

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false });
    }

    const user = await res.json() as GitHubUser;
    return NextResponse.json({ connected: true, username: user.login, avatarUrl: user.avatar_url });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("gh_token", "", { maxAge: 0, path: "/" });
  return response;
}
