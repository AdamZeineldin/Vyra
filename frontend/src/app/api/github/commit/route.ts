import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { githubFetch, getLatestCommitInfo, commitFiles } from "@/lib/github-api";

const commitSchema = z.object({
  repoFullName: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, "Invalid repo format (expected owner/repo)"),
  message: z.string().min(1).max(500).default("Update files from Vyra"),
  files: z.record(z.string().max(500), z.string().max(500_000)).refine(
    (f) => Object.keys(f).length <= 50,
    "Too many files (max 50)"
  ),
});

interface GitHubRepoInfo {
  default_branch: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const token = cookies().get("gh_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated with GitHub" }, { status: 401 });
  }

  const parsed = commitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { repoFullName, message, files } = parsed.data;

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
  } catch {
    return NextResponse.json({ error: "Failed to commit files" }, { status: 500 });
  }
}
