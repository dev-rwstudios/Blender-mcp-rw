import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface BlenderSession {
  id: string;
  port: number;
  label: string;
  connected: boolean;
}

interface BlenderState {
  sessions: BlenderSession[];
  activeSessionId: string | null;
  connect: (port: number, label: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  setActive: (id: string) => void;
}

export const useBlenderStore = create<BlenderState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  connect: async (port, label) => {
    const id = await invoke<string>("blender_connect", { port, label });
    await get().refresh();
    set({ activeSessionId: id });
  },

  disconnect: async (id) => {
    await invoke("blender_disconnect", { sessionId: id });
    await get().refresh();
  },

  refresh: async () => {
    const raw = await invoke<Array<{ id: string; port: number; label: string }>>(
      "blender_list_sessions"
    );
    set({
      sessions: raw.map((s) => ({ ...s, connected: true })),
    });
  },

  setActive: (id) => set({ activeSessionId: id }),
}));
