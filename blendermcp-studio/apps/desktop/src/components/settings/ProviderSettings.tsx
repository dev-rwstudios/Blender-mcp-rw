import { useState } from "react";
import { useSettingsStore, Provider } from "../../stores/settingsStore";

const PROVIDERS: Array<{ id: Provider; label: string; models: string[] }> = [
  {
    id: "anthropic",
    label: "Anthropic",
    models: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
  },
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    models: ["gemini-2.0-flash", "gemini-1.5-pro"],
  },
  {
    id: "groq",
    label: "Groq",
    models: ["llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    models: ["llama3.2", "mistral", "gemma2"],
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    models: ["local-model"],
  },
];

export default function ProviderSettings() {
  const settings = useSettingsStore();
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [saved, setSaved] = useState(false);

  const isLocal = selectedProvider === "ollama" || selectedProvider === "lmstudio";

  const handleSave = async () => {
    if (apiKey) await settings.saveApiKey(selectedProvider, apiKey);
    settings.setProvider({
      provider: selectedProvider,
      model: selectedModel,
      apiKey: isLocal ? undefined : apiKey,
      apiBase: isLocal ? apiBase || undefined : undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold text-white">LLM Provider</h2>

      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProvider(p.id);
              setSelectedModel(p.models[0]);
            }}
            className={`p-2 rounded border text-sm transition-colors ${
              selectedProvider === p.id
                ? "border-[#EA7600] text-[#EA7600] bg-[#EA7600]/10"
                : "border-[#3A3A3A] text-gray-400 hover:border-gray-500"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!isLocal && (
        <div>
          <label className="block text-sm text-gray-300 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EA7600]"
          />
        </div>
      )}

      {isLocal && (
        <div>
          <label className="block text-sm text-gray-300 mb-1">
            API Base URL (optional)
          </label>
          <input
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder={
              selectedProvider === "ollama"
                ? "http://localhost:11434"
                : "http://localhost:1234/v1"
            }
            className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EA7600]"
          />
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-300 mb-1">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#EA7600]"
        >
          {PROVIDERS.find((p) => p.id === selectedProvider)?.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-[#EA7600] hover:bg-orange-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
