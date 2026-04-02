import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 10000;
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per window
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function sanitizeUserContent(content: string): string {
  // Truncate overly long messages
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  // Wrap user content in delimiters to reduce prompt injection effectiveness
  return `<user_message>\n${truncated}\n</user_message>`;
}

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(ip)) {
    return Response.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey || apiKey === "your-ark-api-key-here") {
    return Response.json(
      { error: "未配置 API Key。请在项目根目录创建 .env.local 文件，填入 ARK_API_KEY。" },
      { status: 503 }
    );
  }

  try {
    const { messages } = (await req.json()) as {
      messages: Array<{ role: string; content: string }>;
    };

    if (!messages?.length) {
      return Response.json({ error: "消息不能为空" }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return Response.json({ error: "消息过多，请开始新对话" }, { status: 400 });
    }

    const safeMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.role === "user" ? sanitizeUserContent(m.content) : m.content.slice(0, MAX_CONTENT_LENGTH),
      }));

    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object, no markdown fences, no extra text." },
          ...safeMessages,
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Ark API]", res.status, text);
      if (res.status === 401) return Response.json({ error: "API Key 无效，请检查 .env.local 中的 ARK_API_KEY" }, { status: 401 });
      if (res.status === 429) return Response.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
      return Response.json({ error: `AI 服务异常 (${res.status})` }, { status: 500 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON (handle possible markdown fences)
    let raw = content.trim();
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) raw = fenceMatch[1].trim();

    const parsed = JSON.parse(raw);
    return Response.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    console.error("[API Error]", message);
    // Don't leak internal error details to client
    const isJsonError = message.includes("JSON");
    return Response.json(
      { error: isJsonError ? "AI 返回了无法解析的数据，请重试" : "AI 服务异常，请稍后重试" },
      { status: 500 }
    );
  }
}
