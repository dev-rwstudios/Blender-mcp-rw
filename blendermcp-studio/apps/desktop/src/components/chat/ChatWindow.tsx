import { useRef, useEffect, useState } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBlenderStore } from "../../stores/blenderStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { Send, Square } from "lucide-react";

export default function ChatWindow() {
  const store = useChatStore();
  const settings = useSettingsStore();
  const blender = useBlenderStore();
  const { sendChat, abort } = useWebSocket();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = store.conversations.find((c) => c.id === store.activeConversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, store.streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || store.isStreaming || !store.activeConversationId) return;
    const convId = store.activeConversationId;
    const userMsg = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: input.trim(),
      createdAt: Date.now(),
    };
    store.addMessage(convId, userMsg);
    setInput("");

    const messages = [
      ...(activeConv?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userMsg.content },
    ];

    const cfg = settings.activeProvider;
    const apiKey = await settings.loadApiKey(cfg.provider);
    const activeSession = blender.sessions.find((s) => s.id === blender.activeSessionId);

    sendChat(
      {
        conversation_id: convId,
        messages,
        provider: cfg.provider,
        model: cfg.model,
        api_key: apiKey,
        api_base: cfg.apiBase,
        blender_session_port: activeSession?.port ?? 9876,
      },
      convId
    );
  };

  if (!store.activeConversationId) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#1A1A1A] text-gray-400">
        <p className="text-lg font-medium mb-2">BlenderMCP Studio</p>
        <p className="text-sm">Select or create a conversation to begin</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1A1A1A]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeConv?.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {store.isStreaming && (
          <>
            {store.streamingContent && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: store.streamingContent,
                  createdAt: Date.now(),
                }}
                isStreaming
              />
            )}
            <TypingIndicator />
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#3A3A3A] p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask BlenderMCP Studio..."
            className="flex-1 bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-3 py-2 resize-none text-sm focus:outline-none focus:border-[#EA7600] placeholder-gray-500"
            rows={3}
            disabled={store.isStreaming}
          />
          <div className="flex flex-col gap-2">
            {store.isStreaming ? (
              <button
                onClick={abort}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-[#EA7600] hover:bg-orange-600 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
