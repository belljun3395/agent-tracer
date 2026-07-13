import type http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_USER_ID } from "@monitor/kernel";
import { isAuthEnforced, parseCookie, verifyAuthToken } from "@monitor/platform";
import { MONITOR_SESSION_COOKIE } from "~tracer-api/support/session.const.js";

const HEARTBEAT_MS = 30_000;
const MAX_WS_PAYLOAD = 1 * 1024 * 1024;
const WS_PATH = "/ws";

/** 실시간 전파가 필요로 하는 접속 소켓 등록 능력만 구조적으로 요구한다. */
export interface RealtimeClientRegistry {
    addClient(ws: WebSocket, userId: string): void;
    removeClient(ws: WebSocket): void;
    readonly connections: ReadonlySet<WebSocket>;
    drop(ws: WebSocket): void;
}

/** HTTP 서버에 사용자별 알림 WebSocket 엔드포인트를 연결한다. */
export class WsGateway {
    private wss?: WebSocketServer;
    private heartbeat?: NodeJS.Timeout;

    constructor(private readonly broadcaster: RealtimeClientRegistry) {}

    attach(server: http.Server): void {
        const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD });
        this.wss = wss;

        server.on("upgrade", (request, socket, head) => {
            const requestUrl = request.url ?? "/";
            const { pathname } = new URL(requestUrl, "http://localhost");
            if (pathname !== WS_PATH || !isOriginAllowed(headerValue(request.headers["origin"]))) {
                socket.destroy();
                return;
            }
            const authenticated = authenticateUpgrade(request);
            if (authenticated === WS_UPGRADE_REJECT) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }
            wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request, authenticated));
        });

        wss.on("connection", (ws, request, authenticated?: string | null) => {
            const userId = authenticated ?? resolveUserId(request.url);
            this.broadcaster.addClient(ws, userId);
            const tracked = ws as WebSocket & { isAlive?: boolean };
            tracked.isAlive = true;
            ws.on("pong", () => { tracked.isAlive = true; });
            ws.on("close", () => this.broadcaster.removeClient(ws));
            ws.on("error", () => this.broadcaster.drop(ws));
        });

        const heartbeat = setInterval(() => {
            for (const client of this.broadcaster.connections) {
                const tracked = client as WebSocket & { isAlive?: boolean };
                if (tracked.isAlive === false) {
                    this.broadcaster.drop(client);
                    continue;
                }
                tracked.isAlive = false;
                try {
                    client.ping();
                } catch {
                    this.broadcaster.drop(client);
                }
            }
        }, HEARTBEAT_MS);
        heartbeat.unref();
        this.heartbeat = heartbeat;
    }

    async close(): Promise<void> {
        if (this.heartbeat) clearInterval(this.heartbeat);
        if (this.wss) {
            const wss = this.wss;
            await new Promise<void>((resolve) => wss.close(() => resolve()));
        }
    }
}

function isOriginAllowed(origin: string | undefined): boolean {
    if (process.env["MONITOR_WS_ALLOW_ANY_ORIGIN"] === "1") return true;
    if (!origin) return true;
    try {
        return isLoopbackHost(new URL(origin).hostname);
    } catch {
        return false;
    }
}

function isLoopbackHost(host: string): boolean {
    const normalized = host.toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

export const WS_UPGRADE_REJECT = Symbol("ws.upgrade.reject");

export function authenticateUpgrade(request: http.IncomingMessage): string | null | typeof WS_UPGRADE_REJECT {
    if (!isAuthEnforced()) return null;

    const bearer = headerValue(request.headers["authorization"]);
    if (bearer?.startsWith("Bearer ")) {
        const userId = verifyAuthToken(bearer.slice("Bearer ".length).trim(), "api");
        if (userId !== null) return userId;
    }
    const session = parseCookie(headerValue(request.headers["cookie"]), MONITOR_SESSION_COOKIE);
    if (session !== null) {
        const userId = verifyAuthToken(session, "session");
        if (userId !== null) return userId;
    }
    return WS_UPGRADE_REJECT;
}

function resolveUserId(url: string | undefined): string {
    try {
        const parsed = new URL(url ?? "/", "http://localhost");
        return parsed.searchParams.get("userId")?.trim() || DEFAULT_USER_ID;
    } catch {
        return DEFAULT_USER_ID;
    }
}

function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
