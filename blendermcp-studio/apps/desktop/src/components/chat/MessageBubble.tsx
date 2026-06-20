import { Message } from "../../stores/chatStore";
import ToolCallCard from "./ToolCallCard";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.role === "system";

  if (isError) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] rounded-lg px-4 py-2 bg-red-950/60 border border-red-800 text-red-300 text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isUser
            ? "bg-[#EA7600] text-white"
            : "bg-[#2A2A2A] text-gray-100 border border-[#3A3A3A]"
        }`}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallCard
                key={tc.id}
                name={tc.name}
                input={tc.input}
                result={tc.result}
                isError={tc.isError}
              />
            ))}
          </div>
        )}

        {message.content && (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-[2px] h-4 bg-current ml-0.5 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
