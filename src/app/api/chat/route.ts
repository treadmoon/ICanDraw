import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

const MAX_MESSAGES = 50;

export async function POST(req: Request) {
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
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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
    return Response.json({ error: `AI 服务异常：${message}` }, { status: 500 });
  }
}
