/** 모니터 실시간 연결이 노출하는 이벤트 계약이다. */
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
    /** WebSocket 생성자를 교체한다. 기본값은 `globalThis.WebSocket`. */
    readonly webSocketCtor?: typeof WebSocket;
    /** 첫 재연결 시도까지의 기본 지연(ms). */
    readonly reconnectBaseMs?: number;
    /** 지수 백오프의 상한(ms). */
    readonly reconnectMaxMs?: number;
    /** false면 생성 시 연결하지 않는다. */
    readonly autoConnect?: boolean;
}

const DEFAULT_RECONNECT_BASE_MS = 100;
const DEFAULT_RECONNECT_MAX_MS = 5000;

const READY_STATE_CONNECTING = 0;

/** 브라우저 WebSocket 연결과 재연결을 이벤트 스트림으로 노출한다. */
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

    /** 현재 연결 상태. */
    get isConnected(): boolean {
        return this.connected;
    }

    /** 연결을 영구 종료하며 반복 호출해도 안전하다. */
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
        callAndIgnoreErrors(() => socket.close());
    }

    private connect(): void {
        if (this.destroyed) {
            return;
        }
        const ctor = this.webSocketCtor;
        if (ctor === undefined) {
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
                callAndIgnoreErrors(() => socket.close());
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
        const ceiling = Math.min(
            this.reconnectBaseMs * Math.pow(2, this.reconnectAttempts),
            this.reconnectMaxMs
        );
        const delay = Math.random() * ceiling;
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
                callAndIgnoreErrors(() => listener(payload as string));
            }
            return;
        }
        for (const listener of this.connectionListeners) {
            callAndIgnoreErrors(() => listener(payload as boolean));
        }
    }
}

function resolveGlobalWebSocket(): typeof WebSocket | undefined {
    const globalCandidate = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    return globalCandidate;
}

function callAndIgnoreErrors(action: () => void): void {
    try {
        action();
    } catch {
        return;
    }
}
