import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { aiResponseSchema } from "@/lib/ai/schema";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

export async function POST(req: Request) {
  const { messages } = (await req.json()) as {
    messages: Array<{ role: string; content: string }>;
  };

  const result = await generateObject({
    model: openai("gpt-4o"),
    schema: aiResponseSchema,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  });

  return Response.json(result.object);
}
