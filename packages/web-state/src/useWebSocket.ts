import { useEffect, useRef, useState, useTransition } from "react";
import { createMonitorWebSocket, parseRealtimeMessage, type MonitorRealtimeMessage } from "@monitor/web-io";
export const SOCKET_READY_STATE = {
    CONNECTING: 0,
    OPEN: 1
} as const;
const RECONNECT_BASE_MS = 100;
const RECONNECT_MAX_MS = 5000;
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
export function useWebSocket(onMessage: (message: MonitorRealtimeMessage | null) => void): {
    isConnected: boolean;
} {
    const [isConnected, setIsConnected] = useState(false);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;
    const [, startTransition] = useTransition();
    useEffect(() => {
        let destroyed = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let ws: WebSocket | null = null;
        let closeAfterConnect = false;
        let reconnectAttempts = 0;
        function getReconnectDelay(): number {
            const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts);
            return Math.min(delay, RECONNECT_MAX_MS);
        }
        function connect(): void {
            try {
                ws = createMonitorWebSocket();
            } catch {
                setIsConnected(false);
                if (!destroyed) {
                    const delay = getReconnectDelay();
                    reconnectAttempts += 1;
                    reconnectTimer = setTimeout(connect, delay);
                }
                return;
            }
            ws.onopen = (): void => {
                if (destroyed || closeAfterConnect) {
                    closeAfterConnect = false;
                    ws?.close();
                    return;
                }
                reconnectAttempts = 0;
                setIsConnected(true);
            };
            ws.onmessage = (event): void => {
                setIsConnected(true);
                const message = typeof event.data === "string"
                    ? parseRealtimeMessage(event.data)
                    : null;
                if (debounceTimer !== null)
                    clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    debounceTimer = null;
                    startTransition(() => {
                        onMessageRef.current(message);
                    });
                }, 200);
            };
            ws.onerror = (): void => {
                setIsConnected(false);
            };
            ws.onclose = (): void => {
                setIsConnected(false);
                if (!destroyed) {
                    const delay = getReconnectDelay();
                    reconnectAttempts += 1;
                    reconnectTimer = setTimeout(connect, delay);
                }
            };
        }
        connect();
        return (): void => {
            destroyed = true;
            if (reconnectTimer !== null)
                clearTimeout(reconnectTimer);
            if (debounceTimer !== null)
                clearTimeout(debounceTimer);
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
