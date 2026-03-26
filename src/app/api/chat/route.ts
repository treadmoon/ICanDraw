import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { aiResponseSchema } from "@/lib/ai/schema";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

const ark = createOpenAI({
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
  apiKey: process.env.ARK_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = (await req.json()) as {
    messages: Array<{ role: string; content: string }>;
  };

  const result = await generateObject({
    model: ark(process.env.ARK_MODEL_ID ?? "doubao-1-5-pro-256k-250115"),
    schema: aiResponseSchema,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  });

  return Response.json(result.object);
}
