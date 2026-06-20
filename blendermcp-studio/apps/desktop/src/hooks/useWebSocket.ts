import { useRef, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";

const WS_URL = "ws://127.0.0.1:8765/ws/chat";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useChatStore();

  const sendChat = useCallback(
    (payload: object, conversationId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      store.setStreaming(true);

      ws.onopen = () => ws.send(JSON.stringify(payload));

      ws.onmessage = (ev) => {
        const event = JSON.parse(ev.data) as {
          type: string;
          delta?: string;
          tool_name?: string;
          tool_use_id?: string;
          input?: Record<string, unknown>;
          result?: unknown;
          is_error?: boolean;
          stop_reason?: string;
          message?: string;
        };

        switch (event.type) {
          case "text_delta":
            store.appendStreamDelta(event.delta ?? "");
            break;
          case "tool_result":
            store.updateToolCallResult(
              conversationId,
              event.tool_use_id ?? "",
              event.result,
              event.is_error ?? false
            );
            break;
          case "message_end":
            store.finalizeStreamingMessage(conversationId);
            ws.close();
            break;
          case "error":
            store.addErrorMessage(conversationId, event.message ?? "Unknown error");
            store.setStreaming(false);
            ws.close();
            break;
        }
      };

      ws.onerror = () => store.setStreaming(false);
      ws.onclose = () => {
        if (store.isStreaming && store.streamingContent) {
          store.finalizeStreamingMessage(conversationId);
        } else {
          store.setStreaming(false);
        }
      };
    },
    [store]
  );

  const abort = useCallback(() => {
    wsRef.current?.close();
    store.setStreaming(false);
  }, [store]);

  return { sendChat, abort };
}
