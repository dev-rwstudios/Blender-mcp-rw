import { useState } from "react";
import ChatWindow from "./components/chat/ChatWindow";
import ConversationList from "./components/sidebar/ConversationList";
import BlenderSessionList from "./components/sidebar/BlenderSessionList";
import ProviderSettings from "./components/settings/ProviderSettings";
import BlenderSettings from "./components/settings/BlenderSettings";
import { Settings, MessageSquare } from "lucide-react";

type Panel = "chat" | "settings";

export default function App() {
  const [panel, setPanel] = useState<Panel>("chat");

  return (
    <div className="flex h-screen bg-[#1A1A1A] overflow-hidden">
      {/* Left sidebar */}
      <div className="w-56 shrink-0 flex flex-col bg-[#1A1A1A] border-r border-[#3A3A3A]">
        {/* Logo area */}
        <div className="p-3 border-b border-[#3A3A3A]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#EA7600] flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="text-white text-sm font-semibold">BlenderMCP</span>
          </div>
        </div>

        {/* Nav buttons */}
        <div className="flex border-b border-[#3A3A3A]">
          <button
            onClick={() => setPanel("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              panel === "chat"
                ? "text-[#EA7600] border-b-2 border-[#EA7600]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setPanel("settings")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              panel === "settings"
                ? "text-[#EA7600] border-b-2 border-[#EA7600]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>

        {/* Sidebar content */}
        {panel === "chat" ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <ConversationList />
            </div>
            <div className="border-t border-[#3A3A3A]">
              <BlenderSessionList />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ProviderSettings />
            <div className="border-t border-[#3A3A3A]">
              <BlenderSettings />
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
