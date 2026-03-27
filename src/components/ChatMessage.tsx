import type { ChatMessage } from "@/types";

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.content.startsWith("⚠️");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white"
            : isError
              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
              : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
