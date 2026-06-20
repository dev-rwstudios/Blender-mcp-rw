import { useChatStore } from "../../stores/chatStore";
import { MessageSquare, Plus } from "lucide-react";

export default function ConversationList() {
  const store = useChatStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={() => store.createConversation()}
          className="p-1 hover:bg-[#3A3A3A] rounded text-gray-400 hover:text-white transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {store.conversations.length === 0 && (
          <p className="text-gray-500 text-xs p-3">No conversations yet</p>
        )}
        {store.conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => store.setActiveConversation(conv.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              conv.id === store.activeConversationId
                ? "bg-[#3A3A3A] text-white"
                : "text-gray-400 hover:bg-[#2A2A2A] hover:text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{conv.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
