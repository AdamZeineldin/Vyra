import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { githubFetch, getLatestCommitInfo, commitFiles } from "@/lib/github-api";

interface CreateRepoBody {
  name: string;
  private: boolean;
  description: string;
  files: Record<string, string>; // path → content
}

interface GitHubRepo {
  full_name: string;
  html_url: string;
  default_branch: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const token = cookies().get("gh_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated with GitHub" }, { status: 401 });
  }

  const body: CreateRepoBody = await req.json();

  try {
    // 1. Create the repository (auto_init creates an initial commit + main branch)
    const createRes = await githubFetch(token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        private: body.private,
        description: body.description,
        auto_init: true,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json() as GitHubRepo;
      return NextResponse.json(
        { error: err.message ?? "Failed to create repository" },
        { status: 400 }
      );
    }

    const repo = await createRes.json() as GitHubRepo;
    const { full_name: repoFullName, html_url: repoUrl, default_branch: branch } = repo;

    // 2. Get latest commit info from the auto-initialized repo
    const { commitSha, treeSha } = await getLatestCommitInfo(token, repoFullName, branch);

    // 3. Commit all project files
    const { commitSha: newCommitSha } = await commitFiles({
      token,
      repoFullName,
      files: body.files,
      message: "Add project files from Vyra",
      parentCommitSha: commitSha,
      baseTreeSha: treeSha,
    });

    // 4. Update the branch ref to point to the new commit
    await githubFetch(token, `/repos/${repoFullName}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommitSha }),
    });

    return NextResponse.json({ success: true, repoUrl, repoFullName });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
