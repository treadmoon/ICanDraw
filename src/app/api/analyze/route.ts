import { NextRequest } from "next/server";
import { parseGitHubUrl, fetchKeyFiles } from "@/lib/github/api";
import {
  runIntentAgent,
  runModuleAnalysis,
  runSynthesizerAgent,
  type ModuleAnalysisResult,
} from "@/lib/ai/analyzer";

const MAX_URL_LENGTH = 500;
const MAX_STEPS = 4;
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window
const MAX_TRACKED_IPS = 1000; // prevent memory exhaustion
const requestLog = new Map<string, number[]>();
let lastCleanupTime = Date.now();

// Validate IP format to prevent injection
function isValidIP(ip: string): boolean {
  if (!ip || ip === "unknown" || ip.length > 45) return false;
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

function cleanupRequestLog(): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Always clean up entries older than RATE_LIMIT_WINDOW
  for (const [ip, timestamps] of requestLog) {
    const recent = timestamps.filter((t) => t > windowStart);
    if (recent.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, recent);
    }
  }
  lastCleanupTime = now;
}

function isRateLimited(ip: string): boolean {
  // Skip rate limiting for invalid IPs (fail open)
  if (!isValidIP(ip)) {
    return false;
  }

  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Periodic cleanup every 30 seconds or when at capacity
  if (now - lastCleanupTime > 30_000 || requestLog.size >= MAX_TRACKED_IPS) {
    cleanupRequestLog();
  }

  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);
  recent.push(now);
  requestLog.set(ip, recent);

  return recent.length > RATE_LIMIT_MAX;
}

function focusAreaToType(focusArea: string): "module" | "dataflow" | "state" {
  switch (focusArea) {
    case "api":
      return "dataflow";
    case "state":
      return "state";
    default:
      return "module";
  }
}

type SSEEvent =
  | { type: "step_start"; step: number; description: string }
  | { type: "step_progress"; step: number; message: string }
  | { type: "step_complete"; step: number; result: Record<string, unknown> }
  | { type: "analysis_update"; step: number; findings: string[]; moduleGraph: Record<string, unknown> }
  | { type: "diagram_start"; index: number; total: number; diagramType: string; title: string }
  | { type: "diagram_complete"; index: number; total: number; diagramType: string }
  | { type: "diagrams_ready"; drawings: Array<{ id: string; type: string; elements: unknown[] }> }
  | { type: "done"; summary: string; insights: string[] }
  | { type: "error"; step?: number; message: string };

function sendSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function parseGitHubUrlSafe(url: string) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error("无效的 GitHub 地址");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(parsed.owner) || !/^[a-zA-Z0-9._-]+$/.test(parsed.repo)) {
    throw new Error("无效的仓库地址格式");
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  // Rate limiting - only trust X-Real-IP (set by proxy, not client-spoofable)
  // X-Forwarded-For can be trivially spoofed by clients
  const ip = req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(ip)) {
    return Response.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your-ark-api-key-here") {
    return Response.json(
      { error: "未配置 API Key" },
      { status: 503 }
    );
  }

  try {
    const { repoUrl, maxSteps = MAX_STEPS } = (await req.json()) as {
      repoUrl: string;
      maxSteps?: number;
    };

    if (!repoUrl || typeof repoUrl !== "string" || repoUrl.length > MAX_URL_LENGTH) {
      return Response.json(
        { error: "无效的仓库地址" },
        { status: 400 }
      );
    }

    // Validate maxSteps
    const validatedMaxSteps = Math.min(Math.max(1, maxSteps ?? MAX_STEPS), 10);
    const safeMaxSteps = typeof maxSteps === "number" && maxSteps > 0 ? validatedMaxSteps : MAX_STEPS;

    const { owner, repo } = parseGitHubUrlSafe(repoUrl);

    // Create abort controller for cancellation
    const abortController = new AbortController();

    // Auto-abort after 10 minutes to prevent memory leaks
    const timeoutId = setTimeout(() => abortController.abort(), 10 * 60 * 1000);

    // Set up stream
    const stream = new ReadableStream({
      async start(streamController) {
        const encoder = new TextEncoder();

        const send = (event: SSEEvent) => {
          streamController.enqueue(encoder.encode(sendSSE(event)));
        };

        try {
          // ========== Phase 1: Intent Agent ==========
          send({ type: "step_start", step: 1, description: "理解项目结构和意图..." });

          const profile = await runIntentAgent(owner, repo, apiKey, abortController.signal);

          send({
            type: "step_complete",
            step: 1,
            result: {
              name: profile.name,
              fullName: profile.fullName,
              projectType: profile.projectType,
              techStack: profile.techStack,
            },
          });

          send({
            type: "analysis_update",
            step: 1,
            findings: [`项目类型: ${profile.projectType}`, `技术栈: ${profile.techStack.join(", ")}`],
            moduleGraph: { nodes: [], edges: [] },
          });

          // ========== Phase 2: Module Analysis (Step by Step) ==========
          const analysisResults: ModuleAnalysisResult[] = [];

          // Get analysis plan from profile (or use defaults)
          const plan = profile.analysisPlan?.slice(0, safeMaxSteps) ?? [
            { id: "structure", description: "分析目录结构", priority: 1, focusArea: "structure" },
            { id: "dependencies", description: "分析依赖关系", priority: 2, focusArea: "dependencies" },
          ];

          // Fetch key files once for all steps
          send({ type: "step_progress", step: 1, message: "获取关键文件..." });
          const { files: keyFiles } = await fetchKeyFiles(
            owner,
            repo,
            profile.fileTree,
            profile.defaultBranch,
            30
          );

          // Add key files to the pool
          const analysisFiles = keyFiles.length > 0 ? keyFiles : [];

          for (let i = 0; i < plan.length; i++) {
            const planItem = plan[i];

            send({
              type: "step_start",
              step: i + 2,
              description: planItem.description,
            });

            send({ type: "step_progress", step: i + 2, message: "分析中..." });

            const result = await runModuleAnalysis(
              owner,
              repo,
              profile.defaultBranch,
              {
                id: planItem.id,
                description: planItem.description,
                focusArea: planItem.focusArea,
                type: i === 0 ? "architecture" : focusAreaToType(planItem.focusArea),
              },
              analysisFiles,
              apiKey,
              i + 2,
              abortController.signal
            );

            if (result.status === "done") {
              analysisResults.push(result);
              send({ type: "step_complete", step: i + 2, result: { findings: result.findings } });
              send({
                type: "analysis_update",
                step: i + 2,
                findings: result.findings,
                moduleGraph: result.moduleGraph,
              });
            } else {
              send({
                type: "error",
                step: i + 2,
                message: result.error ?? "分析步骤失败",
              });
              // Continue with next step even if this one failed
            }
          }

          // ========== Phase 3: Synthesis ==========
          send({ type: "step_start", step: plan.length + 2, description: "合成最终图表..." });

          // Get suggested diagram types from profile
          const diagramTypes = profile.suggestedDiagrams ?? ["architecture", "module-graph"];

          // Send diagram progress events
          for (let i = 0; i < diagramTypes.length; i++) {
            const diagramType = diagramTypes[i];
            const titles: Record<string, string> = {
              "architecture": "架构图",
              "module-graph": "模块关系图",
              "data-flow": "数据流图",
              "state-machine": "状态机图",
              "flowchart": "流程图",
            };
            send({
              type: "diagram_start",
              index: i + 1,
              total: diagramTypes.length,
              diagramType,
              title: titles[diagramType] ?? diagramType,
            });
          }

          const synthesis = await runSynthesizerAgent(
            profile,
            analysisResults,
            apiKey,
            abortController.signal
          );

          // Mark diagrams as complete
          for (let i = 0; i < synthesis.drawings.length; i++) {
            send({
              type: "diagram_complete",
              index: i + 1,
              total: synthesis.drawings.length,
              diagramType: synthesis.drawings[i]?.type ?? "unknown",
            });
          }

          send({ type: "diagrams_ready", drawings: synthesis.drawings });
          send({ type: "done", summary: synthesis.summary, insights: synthesis.keyInsights });
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            send({ type: "error", message: "分析已取消" });
          } else {
            send({
              type: "error",
              message: err instanceof Error ? err.message : "分析失败",
            });
          }
        } finally {
          // Clean up timeout
          clearTimeout(timeoutId);
        }

        streamController.enqueue(encoder.encode(": done\n\n"));
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        // Timeout after 10 minutes to prevent memory leaks
        "timeout": "600",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "分析失败" },
      {
        status: 500,
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      }
    );
  }
}
