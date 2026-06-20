import { useState } from "react";
import { useBlenderStore } from "../../stores/blenderStore";
import { Plug, Unplug, RefreshCw } from "lucide-react";

export default function BlenderSettings() {
  const blender = useBlenderStore();
  const [port, setPort] = useState(9876);
  const [label, setLabel] = useState("Blender 1");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await blender.connect(port, label);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold text-white">Blender Connections</h2>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm text-gray-300 mb-1">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EA7600]"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-300 mb-1">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EA7600]"
          />
        </div>
        <div className="flex items-end gap-1">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="p-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            title="Connect"
          >
            {connecting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plug className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="space-y-2">
        {blender.sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => blender.setActive(s.id)}
            className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
              s.id === blender.activeSessionId
                ? "border-[#EA7600] bg-[#EA7600]/10"
                : "border-[#3A3A3A] bg-[#2A2A2A] hover:border-gray-500"
            }`}
          >
            <div>
              <p className="text-white text-sm font-medium">{s.label}</p>
              <p className="text-gray-400 text-xs">localhost:{s.port}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                blender.disconnect(s.id);
              }}
              className="p-1.5 hover:bg-red-900/40 rounded transition-colors"
              title="Disconnect"
            >
              <Unplug className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
