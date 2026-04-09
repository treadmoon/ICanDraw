/**
 * Intent Agent - Phase 1
 * Understands the project and creates an initial profile
 */

import { fetchRepoInfo, fetchRepoTree } from "@/lib/github/api";
import { sanitizeForPrompt } from "@/lib/ai/sanitize";
import type { FileNode } from "@/types";

export interface ProjectProfile {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  projectType: "web-app" | "library" | "api" | "monorepo" | "cli" | "unknown";
  techStack: string[];
  suggestedDiagrams: Array<"architecture" | "module-graph" | "data-flow" | "state-machine" | "flowchart">;
  analysisPlan: AnalysisPlanItem[];
}

export interface AnalysisPlanItem {
  id: string;
  description: string;
  priority: number;
  focusArea: string;
}

/**
 * Intent Agent Prompt
 */
const INTENT_PROMPT = `You are a senior software architect analyzing an open source project. Your goal is to help fellow developers quickly understand:
1. What this project does and why it exists
2. How it's architected and why those choices were made
3. The key concepts and patterns used

## Your Analysis Framework

### 1. Project Purpose
- What problem does this solve?
- Who is the target audience?
- What makes it unique or interesting?

### 2. Technical Insight
- What framework/runtime does it use?
- What are the key architectural patterns?
- What design decisions are notable?

### 3. Structure Understanding
- Where is the entry point?
- How are modules organized?
- What are the core abstractions?

## Output Format
Respond with ONLY valid JSON:
{
  "projectType": "web-app" | "library" | "api" | "monorepo" | "cli" | "mobile" | "unknown",
  "projectPurpose": "这个项目做什么，为什么有用",
  "techStack": ["核心技术1", "核心技术2"],
  "keyPatterns": ["设计模式1", "设计模式2"],
  "entryPoints": ["入口文件或命令"],
  "suggestedDiagrams": ["architecture", "module-graph", "data-flow", "state-machine", "flowchart"],
  "analysisPlan": [
    {
      "id": "step-1",
      "description": "分析什么",
      "priority": 1,
      "focusArea": "structure|dependencies|api|state|components"
    }
  ]
}

## Diagram Selection Guide
- **architecture**: 任何项目都需要，这是全局视图
- **module-graph**: 有多个模块的项目，帮你理解代码组织
- **data-flow**: 有请求-响应模式（API、数据处理）
- **state-machine**: 有状态管理（用户状态、应用状态）
- **flowchart**: 有明确执行流程（CLI、构建工具）

## Analysis Plan Guide
analysisPlan应该包含2-4个分析步骤，按优先级排序：
1. 先看入口和配置（理解怎么启动）
2. 再看核心模块（理解核心逻辑）
3. 最后看辅助模块（理解完整功能）

## Rules
- techStack: 最多5个核心技术
- keyPatterns: 提取2-3个最重要的设计模式
- suggestedDiagrams: 根据项目特点选择2-4种图
- analysisPlan: 每个步骤要有明确目标，顺序要合理`;

/**
 * Run Intent Agent to analyze project
 */
export async function runIntentAgent(
  owner: string,
  repo: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<ProjectProfile & { fileTree: FileNode[]; defaultBranch: string }> {
  // Step 1: Fetch repo info (lightweight)
  const repoInfo = await fetchRepoInfo(owner, repo);
  const defaultBranch = repoInfo.defaultBranch;

  // Step 2: Fetch top-level directory structure (lightweight)
  const fileTree = await fetchRepoTree(owner, repo, defaultBranch);
  const topLevelItems = fileTree
    .map((n) => (n.type === "dir" ? `📁 ${n.name}/` : `📄 ${n.name}`))
    .join("\n");

  // Step 3: Build context for AI (sanitize all external data)
  const context = JSON.stringify({
    repoInfo: {
      name: sanitizeForPrompt(repoInfo.name),
      fullName: sanitizeForPrompt(repoInfo.fullName),
      description: sanitizeForPrompt(repoInfo.description),
      language: repoInfo.language,
      stars: repoInfo.stars,
    },
    topLevelStructure: sanitizeForPrompt(topLevelItems),
  });

  // Step 4: Call AI
  const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115",
      messages: [
        { role: "system", content: INTENT_PROMPT },
        {
          role: "user",
          content: `分析以下 GitHub 项目：\n\n${context}\n\n只返回 JSON，不要其他文字。`,
        },
      ],
      temperature: 0.3,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Intent Agent failed: ${res.status}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON response
  let parsed: Partial<ProjectProfile>;
  try {
    const raw = content.trim().replace(/```json\n?|```\n?/g, "");
    parsed = JSON.parse(raw);
  } catch {
    // Fallback if AI doesn't return valid JSON
    parsed = {
      projectType: "unknown",
      techStack: repoInfo.language ? [repoInfo.language] : [],
      suggestedDiagrams: ["architecture", "module-graph"],
      analysisPlan: [
        { id: "step-1", description: "分析项目结构", priority: 1, focusArea: "structure" },
      ],
    };
  }

  return {
    ...parsed as ProjectProfile,
    name: repoInfo.name,
    fullName: repoInfo.fullName,
    description: repoInfo.description,
    language: repoInfo.language,
    stars: repoInfo.stars,
    fileTree,
    defaultBranch,
  };
}
