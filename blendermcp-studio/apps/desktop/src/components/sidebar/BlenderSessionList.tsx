import { useBlenderStore } from "../../stores/blenderStore";
import { Circle } from "lucide-react";

export default function BlenderSessionList() {
  const blender = useBlenderStore();

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b border-[#3A3A3A]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Blender Sessions
        </span>
      </div>
      <div>
        {blender.sessions.length === 0 && (
          <p className="text-gray-500 text-xs p-3">No active sessions</p>
        )}
        {blender.sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => blender.setActive(s.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              s.id === blender.activeSessionId
                ? "bg-[#3A3A3A] text-white"
                : "text-gray-400 hover:bg-[#2A2A2A] hover:text-white"
            }`}
          >
            <Circle className="w-2.5 h-2.5 fill-green-400 text-green-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm truncate">{s.label}</p>
              <p className="text-xs text-gray-500">:{s.port}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
