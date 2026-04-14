/**
 * Raw AI call endpoint — used by task pipeline subtasks.
 * Each subtask sends its own system prompt + user content.
 */

const MAX_CONTENT_LENGTH = 10000;

export async function POST(req: Request) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey || apiKey === "your-ark-api-key-here") {
    return Response.json({ error: "未配置 API Key" }, { status: 503 });
  }

  try {
    const { systemPrompt, userContent } = (await req.json()) as {
      systemPrompt: string;
      userContent: string;
    };

    if (!systemPrompt || !userContent) {
      return Response.json({ error: "缺少参数" }, { status: 400 });
    }

    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115",
        messages: [
          { role: "system", content: systemPrompt.slice(0, MAX_CONTENT_LENGTH) },
          { role: "user", content: userContent.slice(0, MAX_CONTENT_LENGTH) + "\n\n只返回 JSON。" },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      if (res.status === 429) return Response.json({ error: "请求过于频繁" }, { status: 429 });
      return Response.json({ error: `AI 服务异常 (${res.status})` }, { status: 500 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    return Response.json({ content });
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    return Response.json(
      { error: isTimeout ? "AI 响应超时" : "AI 服务异常" },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
