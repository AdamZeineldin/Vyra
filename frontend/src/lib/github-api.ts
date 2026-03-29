// Shared helpers for GitHub Git Trees API

export type GitHubFetchOptions = RequestInit;

export async function githubFetch(
  token: string,
  path: string,
  options?: GitHubFetchOptions
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

export interface CommitFilesParams {
  token: string;
  repoFullName: string;
  files: Record<string, string>; // path → content
  message: string;
  parentCommitSha: string;
  baseTreeSha: string;
}

export interface CommitResult {
  commitSha: string;
  commitUrl: string;
}

// Creates blobs, a new tree, a commit, and updates the branch ref.
// Returns the new commit SHA.
export async function commitFiles({
  token,
  repoFullName,
  files,
  message,
  parentCommitSha,
  baseTreeSha,
}: CommitFilesParams): Promise<CommitResult> {
  // 1. Create blobs for each file in parallel
  const blobEntries = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const res = await githubFetch(token, `/repos/${repoFullName}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        }),
      });
      const blob = await res.json() as { sha: string };
      return { path, sha: blob.sha };
    })
  );

  // 2. Create a tree referencing all blobs
  const treeRes = await githubFetch(token, `/repos/${repoFullName}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobEntries.map(({ path, sha }) => ({
        path,
        mode: "100644",
        type: "blob",
        sha,
      })),
    }),
  });
  const treeData = await treeRes.json() as { sha: string };

  // 3. Create commit
  const commitRes = await githubFetch(token, `/repos/${repoFullName}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [parentCommitSha],
    }),
  });
  const commit = await commitRes.json() as { sha: string };

  return {
    commitSha: commit.sha,
    commitUrl: `https://github.com/${repoFullName}/commit/${commit.sha}`,
  };
}

// Gets the latest commit SHA and base tree SHA for the default branch of a repo.
export async function getLatestCommitInfo(
  token: string,
  repoFullName: string,
  branch: string
): Promise<{ commitSha: string; treeSha: string }> {
  const refRes = await githubFetch(
    token,
    `/repos/${repoFullName}/git/refs/heads/${branch}`
  );
  const refData = await refRes.json() as { object: { sha: string } };
  const commitSha = refData.object.sha;

  const commitRes = await githubFetch(
    token,
    `/repos/${repoFullName}/git/commits/${commitSha}`
  );
  const commitData = await commitRes.json() as { tree: { sha: string } };

  return { commitSha, treeSha: commitData.tree.sha };
}
