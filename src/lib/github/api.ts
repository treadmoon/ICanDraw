import type { RepoInfo, FileNode } from "@/types";

const GITHUB_API = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_TIMEOUT = 30_000; // 30s timeout

function githubHeaders() {
  return {
    Accept: "application/vnd.github.v3+json",
    ...(GITHUB_TOKEN && { Authorization: `token ${GITHUB_TOKEN}` }),
  };
}

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  owner: { login: string };
}

interface GitHubTreeResponse {
  tree: Array<{ path: string; type: string; size?: number; sha: string }>;
  truncated: boolean;
}

interface GitHubContentResponse {
  type: string;
  path: string;
  content?: string;
  encoding?: string;
  size?: number;
}

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string } | null {
  // Handle formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch
  // git@github.com:owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+(?:\/([^/\s]+))?)?/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2].replace(/\.git$/, ""),
      branch: undefined,
    };
  }

  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  return null;
}

/**
 * Fetch basic repository info
 */
export async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const res = await fetchWithTimeout(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: githubHeaders(),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("仓库不存在或无法访问");
    }
    if (res.status === 403) {
      throw new Error("无法访问仓库，请稍后再试");
    }
    throw new Error("获取仓库信息失败");
  }

  const data: GitHubRepoResponse = await res.json();

  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    defaultBranch: data.default_branch,
  };
}

/**
 * Fetch repository file tree (up to a depth)
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch = "main"
): Promise<FileNode[]> {
  // Use recursive tree to get all files
  const res = await fetchWithTimeout(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: githubHeaders(),
    }
  );

  if (!res.ok) {
    if (res.status === 404) {
      // Try 'master' branch as fallback
      if (branch === "main") {
        return fetchRepoTree(owner, repo, "master");
      }
      throw new Error("无法获取仓库文件树，可能仓库为空或不存在");
    }
    throw new Error("获取文件树失败，请稍后再试");
  }

  const data: GitHubTreeResponse = await res.json();

  // Convert flat tree to nested structure (max 3 levels deep)
  const root: FileNode[] = [];
  const nodes: Record<string, FileNode> = {};

  // Sort by path to ensure parents come before children
  const sorted = data.tree
    .filter((item) => !item.path.includes("/node_modules/") && !item.path.includes("/.git/"))
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    const parts = item.path.split("/");
    const name = parts[parts.length - 1];
    const isDir = item.type === "tree";

    const node: FileNode = {
      path: item.path,
      name,
      type: isDir ? "dir" : "file",
      size: item.size,
    };

    nodes[item.path] = node;

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = nodes[parentPath];
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        // Parent not found, add to root (nested too deep)
        root.push(node);
      }
    }
  }

  return root;
}

/**
 * Fetch a single file's content (decoded from base64)
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch = "main"
): Promise<string> {
  const res = await fetchWithTimeout(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: githubHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("获取文件内容失败，请稍后再试");
  }

  const data: GitHubContentResponse = await res.json();

  if (data.type !== "file") {
    throw new Error(`${path} 不是文件`);
  }

  // Content is base64 encoded
  if (data.encoding === "base64" && data.content) {
    const cleaned = data.content.replace(/\n/g, "");
    return atob(cleaned);
  }

  throw new Error(`无法解码文件 ${path}`);
}

/**
 * Get key files for analysis - prioritizes important entry points
 */
export async function fetchKeyFiles(
  owner: string,
  repo: string,
  tree: FileNode[],
  branch = "main",
  maxFiles = 50
): Promise<{ files: Array<{ path: string; content: string }>; failedCount: number }> {
  const keyPatterns = [
    // Package configs
    /^package\.json$/,
    /^package-lock\.json$/,
    /^pnpm-workspace\.yaml$/,
    /^turbo\.json$/,
    /^nx\.json$/,
    // Config files
    /^tsconfig.*\.json$/,
    /^next\.config\.(js|ts|mjs)$/,
    /^vite\.config\.(js|ts)$/,
    /^webpack\.config\.(js|ts)$/,
    /^rollup\.config\.(js|ts)$/,
    /\.eslintrc/,
    /\.prettierrc/,
    /^tailwind\.config\.(js|ts|cjs)$/,
    // Entry points
    /\/index\.(ts|tsx|js|jsx)$/,
    /\/page\.(ts|tsx|js|jsx)$/,
    /^src\/index\.(ts|tsx|js|jsx)$/,
    /^src\/app\/.*\/page\.(ts|tsx|js|jsx)$/,
    // Store/state files
    /store\.(ts|tsx|js|jsx)$/,
    /\/stores\//,
    // API routes
    /\/api\//,
  ];

  const results: Array<{ path: string; content: string }> = [];
  const seen = new Set<string>();
  let failedCount = 0;

  function collectFiles(nodes: FileNode[]) {
    if (results.length >= maxFiles) return;

    for (const node of nodes) {
      if (results.length >= maxFiles) break;

      if (node.type === "file") {
        const name = node.path.split("/").pop() || "";
        const isKey = keyPatterns.some((re) => re.test(node.path) || re.test(name));

        if (isKey && !seen.has(node.path)) {
          seen.add(node.path);
        }
      }

      if (node.children) {
        collectFiles(node.children);
      }
    }
  }

  collectFiles(tree);

  // Fetch content for selected files in parallel (batches of 10)
  const paths = Array.from(seen).slice(0, maxFiles);
  const CONCURRENCY = 10;

  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (path) => {
        try {
          const content = await fetchFileContent(owner, repo, path, branch);
          return { path, content };
        } catch {
          failedCount++;
          return null;
        }
      })
    );
    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
  }

  return { files: results, failedCount };
}
