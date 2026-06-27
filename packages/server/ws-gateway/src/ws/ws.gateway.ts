import type http from "node:http";
import { createClient } from "redis";
import { WebSocketServer, type WebSocket } from "ws";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { EventBroadcasterService } from "./event.broadcaster.service.js";
import { RedisNotificationPublisher } from "../redis.notification.publisher.js";
import { RedisFanoutSubscriber } from "../redis.fanout.subscriber.js";

const WS_OPEN = 1;
const HEARTBEAT_MS = 30_000;

const MAX_WS_PAYLOAD = 1 * 1024 * 1024;

type RedisClient = ReturnType<typeof createClient>;

export interface WsGatewayHooks {

    readonly acceptUpgrade: (pathname: string, request: http.IncomingMessage) => boolean;

    readonly onUpgradeAttempt?: (
        request: http.IncomingMessage,
        pathname: string,
        accepted: boolean,
    ) => void;

    readonly resolveUserId: (url: string | undefined) => string;

    readonly buildSnapshot: (userId: string) => Promise<unknown>;

    readonly onError?: (message: string) => void;
}

export class WsGateway {
    readonly broadcaster: EventBroadcasterService;
    readonly notifier: INotificationPublisher;
    private wss?: WebSocketServer;
    private heartbeat?: NodeJS.Timeout;

    private constructor(
        private readonly redisPublisher: RedisClient,
        private readonly redisSubscriber: RedisClient,
        broadcaster: EventBroadcasterService,
        notifier: INotificationPublisher,
    ) {
        this.broadcaster = broadcaster;
        this.notifier = notifier;
    }

    static async create(redisUrl: string): Promise<WsGateway> {
        const redisPublisher = createClient({ url: redisUrl });
        const redisSubscriber = redisPublisher.duplicate();
        await redisPublisher.connect();
        await redisSubscriber.connect();
        const broadcaster = new EventBroadcasterService();
        const notifier = new RedisNotificationPublisher(redisPublisher);
        await new RedisFanoutSubscriber(redisSubscriber, broadcaster).start();
        return new WsGateway(redisPublisher, redisSubscriber, broadcaster, notifier);
    }

    attach(server: http.Server, hooks: WsGatewayHooks): void {
        const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD });
        this.wss = wss;

        server.on("upgrade", (request, socket, head) => {
            const requestUrl = request.url ?? "/";
            const { pathname } = new URL(requestUrl, "http://localhost");
            const accepted = hooks.acceptUpgrade(pathname, request);
            hooks.onUpgradeAttempt?.(request, pathname, accepted);
            if (accepted) {
                // 허용된 경로와 Origin일 때만 HTTP upgrade를 WebSocket 연결로 승격한다.
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit("connection", ws, request);
                });
                return;
            }
            socket.destroy();
        });

        wss.on("connection", (ws, request) => {
            const userId = hooks.resolveUserId(request.url);
            this.broadcaster.addClient(ws, userId);

            const tracked = ws as WebSocket & { isAlive?: boolean };
            tracked.isAlive = true;
            ws.on("pong", () => { tracked.isAlive = true; });
            ws.on("close", () => this.broadcaster.removeClient(ws));

            ws.on("error", () => this.broadcaster.drop(ws));
            void hooks.buildSnapshot(userId)
                .then((payload) => {
                    // 스냅샷 생성 중 연결이 닫혔으면 초기 데이터를 보내지 않는다.
                    if (ws.readyState !== WS_OPEN) return;
                    ws.send(JSON.stringify({ type: "snapshot", payload }));
                })
                .catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    (hooks.onError ?? defaultOnError)(`initial snapshot failed: ${message}`);
                    this.broadcaster.drop(ws);
                });
        });

        const heartbeat = setInterval(() => {
            for (const client of this.broadcaster.connections) {
                const tracked = client as WebSocket & { isAlive?: boolean };
                if (tracked.isAlive === false) {
                    // 이전 ping에 pong이 없으면 죽은 연결로 보고 연결 목록에서 제거한다.
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
        await this.redisSubscriber.quit().catch(() => undefined);
        await this.redisPublisher.quit().catch(() => undefined);
        if (this.wss) {
            // 서버 종료 시 새 연결을 막고 기존 WebSocket 서버 close를 기다린다.
            const wss = this.wss;
            await new Promise<void>((resolve) => wss.close(() => resolve()));
        }
    }
}

function defaultOnError(message: string): void {
    process.stderr.write(`[ws-gateway] ${message}\n`);
}
