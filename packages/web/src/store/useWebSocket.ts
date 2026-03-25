/**
 * WebSocket 연결 훅.
 * 자동 재접속(5초), cleanup을 담당.
 */

import { useEffect, useRef, useState } from "react";
import { createMonitorWebSocket } from "../api.js";
import { parseRealtimeMessage, type MonitorRealtimeMessage } from "../lib/realtime.js";

export const SOCKET_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1
} as const;

export function cleanupSocketOnUnmount(input: {
  socket: Pick<WebSocket, "readyState" | "close">;
  deferClose: () => void;
}): void {
  if (input.socket.readyState === SOCKET_READY_STATE.CONNECTING) {
    input.deferClose();
    return;
  }

  input.socket.close();
}

export function useWebSocket(
  onMessage: (message: MonitorRealtimeMessage | null) => void
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;
    let closeAfterConnect = false;

    function connect(): void {
      ws = createMonitorWebSocket();

      ws.onopen = (): void => {
        if (destroyed || closeAfterConnect) {
          closeAfterConnect = false;
          ws?.close();
          return;
        }
        setIsConnected(true);
      };

      ws.onmessage = (event): void => {
        setIsConnected(true);
        const message = typeof event.data === "string"
          ? parseRealtimeMessage(event.data)
          : null;
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          onMessageRef.current(message);
        }, 200);
      };

      ws.onerror = (): void => {
        setIsConnected(false);
      };

      ws.onclose = (): void => {
        setIsConnected(false);
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return (): void => {
      destroyed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      if (ws) {
        cleanupSocketOnUnmount({
          socket: ws,
          deferClose: () => {
            closeAfterConnect = true;
          }
        });
      }
    };
  }, []);

  return { isConnected };
}
