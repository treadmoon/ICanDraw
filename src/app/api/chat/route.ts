import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { aiResponseSchema } from "@/lib/ai/schema";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

function getArkClient() {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey || apiKey === "your-ark-api-key-here") {
    return null;
  }
  return createOpenAI({
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey,
  });
}

const MAX_MESSAGES = 50;

export async function POST(req: Request) {
  const ark = getArkClient();
  if (!ark) {
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

    // Filter out client-injected system messages
    const safeMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const result = await generateObject({
      model: ark(process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115"),
      schema: aiResponseSchema,
      system: SYSTEM_PROMPT,
      messages: safeMessages,
    });

    return Response.json(result.object);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";

    if (message.includes("401") || message.includes("Unauthorized") || message.includes("authentication")) {
      return Response.json({ error: "API Key 无效，请检查 .env.local 中的 ARK_API_KEY" }, { status: 401 });
    }
    if (message.includes("429") || message.includes("rate")) {
      return Response.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return Response.json({ error: "AI 响应超时，请重试" }, { status: 504 });
    }

    console.error("[API Error]", message);
    return Response.json({ error: `AI 服务异常：${message}` }, { status: 500 });
  }
}
