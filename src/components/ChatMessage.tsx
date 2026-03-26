import type { ChatMessage } from "@/types";

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
