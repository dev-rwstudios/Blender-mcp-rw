import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type Provider =
  | "anthropic"
  | "openai"
  | "gemini"
  | "groq"
  | "ollama"
  | "lmstudio"
  | "litellm_proxy";

export interface ProviderConfig {
  provider: Provider;
  apiKey?: string;
  apiBase?: string;
  model: string;
}

interface SettingsState {
  activeProvider: ProviderConfig;
  setProvider: (cfg: ProviderConfig) => void;
  saveApiKey: (provider: string, key: string) => Promise<void>;
  loadApiKey: (provider: string) => Promise<string | null>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeProvider: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },

  setProvider: (cfg) => set({ activeProvider: cfg }),

  saveApiKey: async (provider, key) => {
    await invoke("settings_save_key", { provider, key });
  },

  loadApiKey: async (provider) => {
    return invoke<string | null>("settings_get_key", { provider });
  },
}));
