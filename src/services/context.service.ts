import { getGit } from "../git/client.js";
import { getStatus, getLog } from "./inspect.service.js";

export interface ContextSummary {
  readonly branch: string;
  readonly ahead: number;
  readonly behind: number;
  readonly isClean: boolean;
  readonly changedFiles: number;
  readonly recentCommits: Array<{ hash: string; subject: string; dateIso: string }>;
  readonly remotes: string[];
  readonly inProgress: {
    rebasing: boolean;
    merging: boolean;
    cherryPicking: boolean;
    bisecting: boolean;
  };
}

export async function getContextSummary(repoPath: string): Promise<ContextSummary> {
  const git = getGit(repoPath);
  const [status, commits, remotesRaw, inProgressRaw] = await Promise.all([
    getStatus(repoPath),
    getLog(repoPath, { limit: 5, offset: 0 }),
    git.getRemotes(false),
    git.raw(["rev-parse", "--git-path", "rebase-merge", "--git-path", "MERGE_HEAD", "--git-path", "CHERRY_PICK_HEAD", "--git-path", "BISECT_LOG"])
  ]);

  const paths = inProgressRaw.split("\n").map((line) => line.trim()).filter(Boolean);
  const [rebasePath = "", mergePath = "", cherryPickPath = "", bisectPath = ""] = paths;

  const fsChecks = await Promise.all(
    [rebasePath, mergePath, cherryPickPath, bisectPath].map(async (p) => {
      if (!p) {
        return false;
      }

      try {
        await git.raw(["cat-file", "-e", "HEAD"]);
        await git.raw(["status", "--porcelain"]);
        return true;
      } catch {
        return false;
      }
    })
  );

  return {
    branch: status.current,
    ahead: status.ahead,
    behind: status.behind,
    isClean: status.isClean,
    changedFiles: status.files.length,
    recentCommits: commits.map((commit) => ({
      hash: commit.hash,
      subject: commit.subject,
      dateIso: commit.dateIso
    })),
    remotes: remotesRaw.map((remote) => remote.name),
    inProgress: {
      rebasing: fsChecks[0],
      merging: fsChecks[1],
      cherryPicking: fsChecks[2],
      bisecting: fsChecks[3]
    }
  };
}

export async function searchHistory(repoPath: string, query: string, limit: number): Promise<string> {
  const git = getGit(repoPath);

  const [pickaxe, grep] = await Promise.all([
    git.raw(["log", "-S", query, "--oneline", "-n", String(limit)]),
    git.raw(["grep", "-n", "--", query])
      .catch(() => "")
  ]);

  const sections = [
    "## Pickaxe (-S)",
    pickaxe.trim() || "No history matches.",
    "",
    "## grep",
    grep.trim() || "No working-tree matches."
  ];

  return sections.join("\n");
}

export async function getConfig(repoPath: string, key?: string): Promise<string> {
  const git = getGit(repoPath);
  if (key) {
    const value = await git.raw(["config", "--get", key]);
    return value.trim();
  }

  const output = await git.raw(["config", "--list"]);
  return output.trim();
}

export async function setConfig(repoPath: string, key: string, value: string): Promise<string> {
  const git = getGit(repoPath);
  await git.raw(["config", key, value]);
  return `Set ${key}.`;
}
