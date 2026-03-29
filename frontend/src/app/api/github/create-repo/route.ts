import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { githubFetch, getLatestCommitInfo, commitFiles } from "@/lib/github-api";

const createRepoSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/, "Invalid repo name"),
  private: z.boolean(),
  description: z.string().max(350).default(""),
  files: z.record(z.string().max(500), z.string().max(500_000)).refine(
    (f) => Object.keys(f).length <= 50,
    "Too many files (max 50)"
  ),
});

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

  const parsed = createRepoSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

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
  } catch {
    return NextResponse.json({ error: "Failed to create repository" }, { status: 500 });
  }
}
