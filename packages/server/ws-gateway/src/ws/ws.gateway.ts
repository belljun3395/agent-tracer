import type http from "node:http";
import { createClient } from "redis";
import { WebSocketServer, type WebSocket } from "ws";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { EventBroadcasterService } from "./event.broadcaster.service.js";
import { RedisNotificationPublisher } from "../redis.notification.publisher.js";
import { RedisFanoutSubscriber } from "../redis.fanout.subscriber.js";

const WS_OPEN = 1;
const HEARTBEAT_MS = 30_000;
// Clients only ever send tiny control frames; cap inbound payloads far below
// ws's 100 MiB default so a single oversized frame can't exhaust memory.
const MAX_WS_PAYLOAD = 1 * 1024 * 1024;

type RedisClient = ReturnType<typeof createClient>;

/** Transport-level policy supplied by the composition root (api-gateway). */
export interface WsGatewayHooks {
    /** Accept or reject an upgrade for the given path + request (origin policy). */
    readonly acceptUpgrade: (pathname: string, request: http.IncomingMessage) => boolean;
    /**
     * Side-effects on every upgrade attempt — request-context assignment and
     * access logging. Runs whether or not the upgrade was accepted.
     */
    readonly onUpgradeAttempt?: (
        request: http.IncomingMessage,
        pathname: string,
        accepted: boolean,
    ) => void;
    /** Resolve the userId for a connection from its URL. */
    readonly resolveUserId: (url: string | undefined) => string;
    /** Build the per-connection initial snapshot, scoped to the resolved user. */
    readonly buildSnapshot: (userId: string) => Promise<unknown>;
    /** Optional error reporter (defaults to stderr). */
    readonly onError?: (message: string) => void;
}

/**
 * WebSocket edge for the dashboard live stream. Owns the Redis pub/sub fan-out,
 * the WS server lifecycle (upgrade handshake, connection registry, heartbeat
 * reaping) and the initial-snapshot push. The composition root supplies the
 * HTTP server and transport policy via {@link WsGatewayHooks}; this class holds
 * no domain, config, or HTTP-framework knowledge.
 *
 * Two-phase init: {@link create} connects Redis (so {@link notifier} can be
 * wired into the app before it boots), then {@link attach} binds the WS server
 * to the already-listening HTTP server.
 */
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

    /**
     * Phase 1 — connect Redis and start the cross-pod fan-out subscriber.
     * Call before creating the Nest app so {@link notifier} can be injected.
     */
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

    /** Phase 2 — bind the WS server to the HTTP server. */
    attach(server: http.Server, hooks: WsGatewayHooks): void {
        const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD });
        this.wss = wss;

        server.on("upgrade", (request, socket, head) => {
            const requestUrl = request.url ?? "/";
            const { pathname } = new URL(requestUrl, "http://localhost");
            const accepted = hooks.acceptUpgrade(pathname, request);
            hooks.onUpgradeAttempt?.(request, pathname, accepted);
            if (accepted) {
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
            // Heartbeat liveness: ws does NOT auto-detect dead peers, so a client
            // that vanishes without a clean close (laptop sleep, Wi-Fi drop)
            // would otherwise linger in the registry forever.
            const tracked = ws as WebSocket & { isAlive?: boolean };
            tracked.isAlive = true;
            ws.on("pong", () => { tracked.isAlive = true; });
            ws.on("close", () => this.broadcaster.removeClient(ws));
            // A ws socket that emits 'error' with no listener throws and crashes
            // the process; drop the client instead.
            ws.on("error", () => this.broadcaster.drop(ws));
            void hooks.buildSnapshot(userId)
                .then((payload) => {
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
            const wss = this.wss;
            await new Promise<void>((resolve) => wss.close(() => resolve()));
        }
    }
}

function defaultOnError(message: string): void {
    process.stderr.write(`[ws-gateway] ${message}\n`);
}
