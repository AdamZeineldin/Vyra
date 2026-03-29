import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { githubFetch, getLatestCommitInfo, commitFiles } from "@/lib/github-api";

interface CommitBody {
  repoFullName: string; // "owner/repo"
  message: string;
  files: Record<string, string>; // path → content
}

interface GitHubRepoInfo {
  default_branch: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const token = cookies().get("gh_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated with GitHub" }, { status: 401 });
  }

  const body: CommitBody = await req.json();
  const { repoFullName, message, files } = body;

  try {
    // 1. Get the repo's default branch
    const repoRes = await githubFetch(token, `/repos/${repoFullName}`);
    if (!repoRes.ok) {
      const err = await repoRes.json() as GitHubRepoInfo;
      return NextResponse.json(
        { error: err.message ?? "Repository not found" },
        { status: 404 }
      );
    }
    const repoData = await repoRes.json() as GitHubRepoInfo;
    const branch = repoData.default_branch ?? "main";

    // 2. Get latest commit info
    const { commitSha, treeSha } = await getLatestCommitInfo(token, repoFullName, branch);

    // 3. Commit files
    const { commitSha: newCommitSha, commitUrl } = await commitFiles({
      token,
      repoFullName,
      files,
      message,
      parentCommitSha: commitSha,
      baseTreeSha: treeSha,
    });

    // 4. Update the branch ref
    await githubFetch(token, `/repos/${repoFullName}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommitSha }),
    });

    return NextResponse.json({ success: true, commitUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
