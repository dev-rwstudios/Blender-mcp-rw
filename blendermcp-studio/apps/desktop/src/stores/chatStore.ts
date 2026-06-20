import { create } from "zustand";

export type MessageRole = "user" | "assistant" | "tool" | "system";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model?: string;
  provider?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingContent: string;

  setActiveConversation: (id: string) => void;
  createConversation: () => string;
  addMessage: (convId: string, msg: Message) => void;
  appendStreamDelta: (delta: string) => void;
  setStreaming: (val: boolean) => void;
  finalizeStreamingMessage: (convId: string) => void;
  updateToolCallResult: (
    convId: string,
    toolUseId: string,
    result: unknown,
    isError: boolean
  ) => void;
  addErrorMessage: (convId: string, errorText: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingContent: "",

  setActiveConversation: (id) => set({ activeConversationId: id }),

  createConversation: () => {
    const id = crypto.randomUUID();
    const conv: Conversation = {
      id,
      title: "New Chat",
      messages: [],
    };
    set((s) => ({
      conversations: [...s.conversations, conv],
      activeConversationId: id,
    }));
    return id;
  },

  addMessage: (convId, msg) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, messages: [...c.messages, msg] } : c
      ),
    })),

  appendStreamDelta: (delta) =>
    set((s) => ({ streamingContent: s.streamingContent + delta })),

  setStreaming: (val) =>
    set({ isStreaming: val, streamingContent: val ? "" : get().streamingContent }),

  finalizeStreamingMessage: (convId) => {
    const content = get().streamingContent;
    if (!content) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: Date.now(),
    };
    get().addMessage(convId, msg);
    set({ streamingContent: "", isStreaming: false });
  },

  updateToolCallResult: (convId, toolUseId, result, isError) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) => ({
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.id === toolUseId ? { ...tc, result, isError } : tc
                ),
              })),
            }
          : c
      ),
    })),

  addErrorMessage: (convId, errorText) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "system",
      content: `⚠ ${errorText}`,
      createdAt: Date.now(),
    };
    get().addMessage(convId, msg);
    set({ streamingContent: "", isStreaming: false });
  },
}));
