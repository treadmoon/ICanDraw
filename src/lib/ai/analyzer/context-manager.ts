/**
 * Context Manager - File selection and summarization for AI prompts
 */

/**
 * Create a truncated file summary for AI context
 */
export function summarizeFileContent(
  path: string,
  content: string,
  maxLines = 100
): string {
  const lines = content.split("\n");
  const summary = lines.slice(0, maxLines).join("\n");
  const truncated = lines.length > maxLines ? `\n... [还有 ${lines.length - maxLines} 行]` : "";
  return `[文件: ${path}]\n${summary}${truncated}`;
}

/**
 * Select most relevant files based on path patterns
 */
export function selectKeyFiles(
  files: Array<{ path: string; content: string }>,
  maxFiles: number,
  maxCharsPerFile: number
): Array<{ path: string; content: string }> {
  const keyPatterns = [
    // Entry points first
    /\/page\.(ts|tsx|js|jsx)$/,
    /\/index\.(ts|tsx|js|jsx)$/,
    /\/layout\.(ts|tsx|js|jsx)$/,
    // Config
    /^package\.json$/,
    /^next\.config\.(js|ts|mjs)$/,
    /^vite\.config\.(js|ts)$/,
    // Store/state
    /store\.(ts|tsx|js|jsx)$/,
    /\/stores\//,
    // API
    /\/api\//,
    // Hooks
    /\/hooks?\//,
  ];

  const scored = files.map((f) => {
    let score = 0;
    for (const pattern of keyPatterns) {
      if (pattern.test(f.path)) {
        score += 10;
      }
    }
    // Prefer shorter files
    score -= f.content.length / 1000;
    return { ...f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: Array<{ path: string; content: string }> = [];
  let totalChars = 0;

  for (const file of scored) {
    const truncated =
      file.content.length > maxCharsPerFile
        ? file.content.slice(0, maxCharsPerFile) + "\n... [截断]"
        : file.content;

    if (totalChars + truncated.length > maxFiles * maxCharsPerFile) {
      continue;
    }

    selected.push({ path: file.path, content: truncated });
    totalChars += truncated.length;
  }

  return selected;
}
