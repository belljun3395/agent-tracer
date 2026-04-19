// Connection-lifecycle wrapper around the browser WebSocket.
//
// The previous web-store implementation forced every React hook to reason
// about construction failures, exponential backoff, unmount races, and
// debouncing at once — and still leaked uncaught errors when the WebSocket
// constructor threw (invalid URL, WebSocket missing entirely, etc.). This
// class encapsulates all of that so the rest of the app only sees two event
// streams: raw `message` payloads and `connectionChange` booleans.
//
// Intentionally framework-free. Message parsing, React integration, and
// debouncing live higher up (in `@monitor/web-state`).

export type MonitorSocketEventMap = {
    readonly message: string;
    readonly connectionChange: boolean;
};

export type MonitorSocketListener<K extends keyof MonitorSocketEventMap> = (
    payload: MonitorSocketEventMap[K]
) => void;

export type MonitorSocketUnsubscribe = () => void;

export interface MonitorSocketOptions {
    readonly url: string;
    /** Override the WebSocket constructor. Defaults to `globalThis.WebSocket`. */
    readonly webSocketCtor?: typeof WebSocket;
    /** Base delay for the first reconnect attempt, in ms. */
    readonly reconnectBaseMs?: number;
    /** Upper bound on the exponential backoff, in ms. */
    readonly reconnectMaxMs?: number;
    /** Start disconnected instead of dialing immediately (useful for tests). */
    readonly autoConnect?: boolean;
}

const DEFAULT_RECONNECT_BASE_MS = 100;
const DEFAULT_RECONNECT_MAX_MS = 5000;

const READY_STATE_CONNECTING = 0;

export class MonitorSocket {
    private readonly url: string;
    private readonly webSocketCtor: typeof WebSocket | undefined;
    private readonly reconnectBaseMs: number;
    private readonly reconnectMaxMs: number;

    private readonly messageListeners: Set<MonitorSocketListener<"message">> = new Set();
    private readonly connectionListeners: Set<MonitorSocketListener<"connectionChange">> = new Set();

    private socket: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private destroyed = false;
    private connected = false;
    /**
     * When close() arrives while the socket is still CONNECTING, the browser
     * will still fire `open` once the handshake finishes. We must close it
     * then — otherwise the socket stays alive after the caller expected it to
     * be gone. This mirrors the race the old hook handled via `closeAfterConnect`.
     */
    private closeAfterConnect = false;

    constructor(options: MonitorSocketOptions) {
        this.url = options.url;
        this.webSocketCtor = options.webSocketCtor ?? resolveGlobalWebSocket();
        this.reconnectBaseMs = options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
        this.reconnectMaxMs = options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;

        if (options.autoConnect !== false) {
            this.connect();
        }
    }

    on(
        event: "message",
        listener: MonitorSocketListener<"message">
    ): MonitorSocketUnsubscribe;
    on(
        event: "connectionChange",
        listener: MonitorSocketListener<"connectionChange">
    ): MonitorSocketUnsubscribe;
    on<K extends keyof MonitorSocketEventMap>(
        event: K,
        listener: MonitorSocketListener<K>
    ): MonitorSocketUnsubscribe {
        if (event === "message") {
            const bucket = this.messageListeners;
            const typed = listener as MonitorSocketListener<"message">;
            bucket.add(typed);
            return () => {
                bucket.delete(typed);
            };
        }
        const bucket = this.connectionListeners;
        const typed = listener as MonitorSocketListener<"connectionChange">;
        bucket.add(typed);
        return () => {
            bucket.delete(typed);
        };
    }

    /** Current connection state as last reported by the underlying socket. */
    get isConnected(): boolean {
        return this.connected;
    }

    /**
     * Tear down the socket and suppress further reconnects. Safe to call
     * multiple times and during any connection phase.
     */
    close(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;

        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        const socket = this.socket;
        this.socket = null;

        if (socket === null) {
            return;
        }
        if (socket.readyState === READY_STATE_CONNECTING) {
            this.closeAfterConnect = true;
            return;
        }
        try {
            socket.close();
        } catch {
            // Closing a socket should not throw in practice; ignore if it does.
        }
    }

    private connect(): void {
        if (this.destroyed) {
            return;
        }
        const ctor = this.webSocketCtor;
        if (ctor === undefined) {
            // No WebSocket implementation available; stay disconnected.
            this.updateConnected(false);
            return;
        }

        let socket: WebSocket;
        try {
            socket = new ctor(this.url);
        } catch {
            this.updateConnected(false);
            this.scheduleReconnect();
            return;
        }

        this.socket = socket;

        socket.onopen = (): void => {
            if (this.closeAfterConnect || this.destroyed) {
                this.closeAfterConnect = false;
                try {
                    socket.close();
                } catch {
                    // ignore
                }
                return;
            }
            this.reconnectAttempts = 0;
            this.updateConnected(true);
        };

        socket.onmessage = (event: MessageEvent): void => {
            if (this.destroyed) {
                return;
            }
            if (typeof event.data !== "string") {
                return;
            }
            this.emit("message", event.data);
        };

        socket.onerror = (): void => {
            this.updateConnected(false);
        };

        socket.onclose = (): void => {
            this.socket = null;
            this.updateConnected(false);
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect(): void {
        if (this.destroyed || this.reconnectTimer !== null) {
            return;
        }
        const delay = Math.min(
            this.reconnectBaseMs * Math.pow(2, this.reconnectAttempts),
            this.reconnectMaxMs
        );
        this.reconnectAttempts += 1;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    private updateConnected(next: boolean): void {
        if (this.connected === next) {
            return;
        }
        this.connected = next;
        this.emit("connectionChange", next);
    }

    private emit<K extends keyof MonitorSocketEventMap>(
        event: K,
        payload: MonitorSocketEventMap[K]
    ): void {
        if (event === "message") {
            for (const listener of this.messageListeners) {
                try {
                    listener(payload as string);
                } catch {
                    // A listener throwing must not break the socket or other listeners.
                }
            }
            return;
        }
        for (const listener of this.connectionListeners) {
            try {
                listener(payload as boolean);
            } catch {
                // A listener throwing must not break the socket or other listeners.
            }
        }
    }
}

function resolveGlobalWebSocket(): typeof WebSocket | undefined {
    const globalCandidate = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    return globalCandidate;
}
