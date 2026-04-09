import type { ModuleGraph, ModuleNode, ModuleEdge, FileNode } from "@/types";

// File type detection based on path
export type FileCategory = "component" | "hook" | "store" | "api" | "lib" | "page" | "config" | "module" | "other";

export function detectFileCategory(path: string): FileCategory {
  const lower = path.toLowerCase();
  const name = lower.split("/").pop() || "";

  // Config files
  if (
    name.startsWith("package") ||
    name.startsWith("tsconfig") ||
    name.startsWith("eslint") ||
    name.startsWith("prettier") ||
    name.startsWith(".env") ||
    name.includes("config") ||
    name.includes("rc")
  ) {
    return "config";
  }

  // Next.js app router pages
  if (/\/app\/.*page\.(ts|tsx|js|jsx)$/.test(lower)) {
    return "page";
  }

  // Pages directory (Next.js pages router)
  if (/\/pages\//.test(lower) && (lower.includes("page") || lower.includes("index"))) {
    return "page";
  }

  // API routes
  if (/\/api\//.test(lower)) {
    return "api";
  }

  // Stores (Zustand, Redux, etc.)
  if (/\/store|stores\//.test(lower) || name.includes("store") || name.includes("reducer")) {
    return "store";
  }

  // Hooks
  if (/\/hooks?\//.test(lower) || name.startsWith("use") || name.startsWith("use")) {
    return "hook";
  }

  // Components
  if (/\/components?\//.test(lower) || /\/[A-Z][a-zA-Z]*\.(ts|tsx|js|jsx)$/.test(lower)) {
    // Exclude pages and api
    if (!lower.includes("/pages/") && !lower.includes("/app/")) {
      return "component";
    }
  }

  // Lib / utils
  if (/\/lib\//.test(lower) || /\/(utils|helpers|util|helper)/.test(lower)) {
    return "lib";
  }

  // Type definitions
  if (/\/types?\//.test(lower) || name.includes("type") || name.includes("interface")) {
    return "lib";
  }

  // Module index files
  if (name === "index.ts" || name === "index.tsx" || name === "mod.ts") {
    return "module";
  }

  return "other";
}

// Extract import statements from JS/TS content
export function parseImports(content: string): string[] {
  const imports: string[] = [];

  // ES6 imports: import x from '...'
  const es6Regex = /import\s+(?:(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"])/g;
  let match;
  while ((match = es6Regex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Require: const x = require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic imports: import('...')
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports.filter((imp) => !imp.startsWith(".") && !imp.startsWith("/"));
}

// Extract export statements
export function parseExports(content: string): string[] {
  const exports: string[] = [];

  // Named exports: export const x = ...
  const namedRegex = /export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/g;
  let match;
  while ((match = namedRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Default export: export default ...
  if (/export\s+default/.test(content)) {
    exports.push("default");
  }

  // Re-exports: export { x } from '...'
  const reExportRegex = /export\s+\{[^}]+\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    exports.push(`re-export:${match[1]}`);
  }

  return exports;
}

// Parse package.json dependencies
export function parseDependencies(pkgJsonContent: string): {
  dependencies: string[];
  devDependencies: string[];
  peerDependencies: string[];
} {
  try {
    const pkg = JSON.parse(pkgJsonContent);
    return {
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      peerDependencies: Object.keys(pkg.peerDependencies || {}),
    };
  } catch {
    return { dependencies: [], devDependencies: [], peerDependencies: [] };
  }
}

// Build module graph from file list and import data
export function buildModuleGraph(
  files: Array<{ path: string; content: string }>
): ModuleGraph {
  const nodes: ModuleNode[] = [];
  const edges: ModuleEdge[] = [];
  const nodeMap = new Map<string, ModuleNode>();

  // Create nodes for each file
  for (const file of files) {
    const category = detectFileCategory(file.path);
    const name = file.path.split("/").pop()?.replace(/\.(ts|tsx|js|jsx)$/, "") || file.path;

    const node: ModuleNode = {
      id: file.path,
      name,
      path: file.path,
      type: category === "other" ? "module" : category,
      connections: 0,
    };

    nodes.push(node);
    nodeMap.set(file.path, node);
  }

  // Create edges based on imports
  for (const file of files) {
    const imports = parseImports(file.content);

    for (const imp of imports) {
      // Try to match import to a node
      let targetPath: string | null = null;

      // Check relative imports
      const relativeMatch = imp.startsWith(".");
      if (relativeMatch) {
        // Resolve relative path
        const baseDir = file.path.split("/").slice(0, -1).join("/");
        targetPath = resolvePath(baseDir, imp);
      } else {
        // Check if it matches any node by name
        const impName = imp.split("/").pop()?.replace(/\.(ts|tsx|js|jsx)$/, "");
        for (const [path, node] of nodeMap) {
          if (path.split("/").pop()?.replace(/\.(ts|tsx|js|jsx)$/, "") === impName) {
            targetPath = path;
            break;
          }
        }
      }

      if (targetPath && targetPath !== file.path && nodeMap.has(targetPath)) {
        edges.push({
          from: file.path,
          to: targetPath,
          type: "imports",
        });

        // Increment connection count for the target (incoming dependency)
        const targetNode = nodeMap.get(targetPath)!;
        targetNode.connections++;
      }
    }
  }

  return { nodes, edges };
}

// Resolve relative path
function resolvePath(baseDir: string, relative: string): string {
  const parts = [...baseDir.split("/"), ...relative.split("/")];
  const result: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      result.pop();
    } else if (part !== ".") {
      result.push(part);
    }
  }

  return result.join("/");
}

// Flatten file tree for display
export function flattenTree(tree: FileNode[]): FileNode[] {
  const result: FileNode[] = [];

  function traverse(nodes: FileNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}

// Get top-level directories from tree
export function getTopLevelDirs(tree: FileNode[]): FileNode[] {
  return tree.filter((node) => node.type === "dir");
}

// Get src/package directories
export function getSourceDirs(tree: FileNode[]): FileNode[] {
  const flat = flattenTree(tree);
  return flat.filter(
    (n) =>
      n.type === "dir" &&
      (n.path.startsWith("src/") ||
        n.path === "src" ||
        n.path.startsWith("packages/") ||
        n.path.startsWith("lib/") ||
        n.path === "lib")
  );
}
