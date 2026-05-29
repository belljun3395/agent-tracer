import * as fs from "node:fs";
import * as net from "node:net";
import {resolveMonitorTransportConfig} from "~shared/config/env.js";
import {createMonitorTransport} from "./transport.js";
import {
    DAEMON_SOCKET_MODE,
    type DaemonMessage,
    ensureDaemonHome,
    localEnsureResult,
    resolveDaemonHomeLayout,
} from "./local-daemon.js";

interface IdMapping {
    readonly localTaskId: string;
    readonly localSessionId: string;
    readonly taskId: string;
    readonly sessionId: string;
}

const MAPPING_CAP = 1024;
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;
// Cap the in-memory backlog so a sustained monitor outage (every POST timing
// out) can't grow the queue without bound and OOM the daemon. Oldest messages
// are dropped first; loss is acceptable for a best-effort local tool, but it
// must be observable in daemon.log rather than silent.
const MAX_QUEUE = 10_000;

const layout = resolveDaemonHomeLayout();
const direct = createMonitorTransport(resolveMonitorTransportConfig(), {forceDirect: true});
const mappings = new Map<string, IdMapping>();
const queue: DaemonMessage[] = [];
let processing = false;
let lastActivityAt = Date.now();
let shuttingDown = false;
let droppedCount = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rememberMapping(message: DaemonMessage, result: unknown): void {
    if (message.pathname !== "/ingest/v1/sessions/ensure") return;
    if (!message.localResult || !isRecord(result)) return;
    const taskId = typeof result.taskId === "string" ? result.taskId : undefined;
    const sessionId = typeof result.sessionId === "string" ? result.sessionId : undefined;
    if (!taskId || !sessionId) return;
    const mapping: IdMapping = {
        localTaskId: message.localResult.taskId,
        localSessionId: message.localResult.sessionId,
        taskId,
        sessionId,
    };
    setMapping(mapping.localSessionId, mapping);
}

function setMapping(key: string, mapping: IdMapping): void {
    if (mappings.has(key)) {
        mappings.delete(key);
    } else if (mappings.size >= MAPPING_CAP) {
        // FIFO eviction: Map preserves insertion order, so the oldest key sits first.
        const oldest = mappings.keys().next().value;
        if (oldest !== undefined) mappings.delete(oldest);
    }
    mappings.set(key, mapping);
}

function rewriteEventIds(event: unknown): unknown {
    if (!isRecord(event)) return event;
    const sessionId = typeof event.sessionId === "string" ? event.sessionId : undefined;
    const mapping = sessionId ? mappings.get(sessionId) : undefined;
    if (!mapping || !sessionId) return event;
    // Touch on read so an active, long-streaming session is treated as
    // most-recently-used and isn't evicted by churn of many newer short
    // sessions (FIFO eviction would otherwise drop it past MAPPING_CAP and
    // leave its later events with un-rewritten local placeholder IDs).
    mappings.delete(sessionId);
    mappings.set(sessionId, mapping);
    return {
        ...event,
        taskId: event.taskId === mapping.localTaskId ? mapping.taskId : event.taskId,
        sessionId: mapping.sessionId,
    };
}

function rewriteBody(body: unknown): unknown {
    if (!isRecord(body) || !Array.isArray(body.events)) return body;
    return {...body, events: body.events.map(rewriteEventIds)};
}

async function processMessage(message: DaemonMessage): Promise<void> {
    const body = rewriteBody(message.body);
    try {
        const result = await direct.postJson(message.pathname, body);
        rememberMapping(message, result);
    } catch (err) {
        // Hook path is intentionally fire-and-forget. Surface the failure on the
        // daemon's log channel so silent monitor downtime is recoverable in
        // post-mortems, but do not propagate the error to the hook process.
        process.stderr.write(`[agent-tracer-daemon] post failed pathname=${message.pathname} err=${String(err)}\n`);
    }
}

async function drain(): Promise<void> {
    if (processing) return;
    processing = true;
    try {
        for (;;) {
            const message = queue.shift();
            if (!message) return;
            await processMessage(message);
        }
    } finally {
        processing = false;
    }
}

function enqueue(message: DaemonMessage): void {
    lastActivityAt = Date.now();
    if (message.pathname === "/ingest/v1/sessions/ensure") {
        const local = message.localResult ?? localEnsureResult(message.body);
        setMapping(local.sessionId, {
            localTaskId: local.taskId,
            localSessionId: local.sessionId,
            taskId: local.taskId,
            sessionId: local.sessionId,
        });
    }
    if (queue.length >= MAX_QUEUE) {
        queue.shift();
        droppedCount += 1;
        if (droppedCount === 1 || droppedCount % 1000 === 0) {
            process.stderr.write(
                `[agent-tracer-daemon] queue full (cap=${MAX_QUEUE}) — dropped ${droppedCount} oldest message(s); monitor likely unreachable\n`,
            );
        }
    }
    queue.push(message);
    void drain();
}

function parseLines(socket: net.Socket): void {
    let buffer = "";
    socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        for (;;) {
            const index = buffer.indexOf("\n");
            if (index === -1) break;
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            if (!line) continue;
            try {
                enqueue(JSON.parse(line) as DaemonMessage);
            } catch {
                // ignore malformed messages
            }
        }
    });
}

async function probeExistingDaemon(socketPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.createConnection(socketPath);
        let settled = false;
        const finish = (alive: boolean) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(alive);
        };
        socket.setTimeout(100, () => finish(false));
        socket.once("error", () => finish(false));
        socket.once("connect", () => finish(true));
    });
}

async function gracefulShutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stderr.write(`[agent-tracer-daemon] ${signal} — draining ${queue.length} queued messages\n`);
    server.close();
    await drain();
    process.exit(0);
}

ensureDaemonHome(layout);

const server = net.createServer(parseLines);

function listenOnSocket(): void {
    server.listen({ path: layout.socketPath, exclusive: true });
}

server.on("listening", () => {
    try {
        fs.chmodSync(layout.socketPath, DAEMON_SOCKET_MODE);
    } catch {
        // best-effort: unix domain socket should already be mode 0755 on POSIX
    }
    process.stderr.write(`[agent-tracer-daemon] listening at ${layout.socketPath} (pid=${process.pid})\n`);
});

let reclaimAttempted = false;
server.on("error", (err) => {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE" && !reclaimAttempted) {
        reclaimAttempted = true;
        // The path is taken: either a live daemon (yield to it) or a stale
        // socket left by a crashed one. NEVER unlink a socket that is actually
        // being served (that was the old spawn-race bug where a losing daemon
        // deleted the winner's socket) — only reclaim it once a probe confirms
        // nothing is listening.
        void probeExistingDaemon(layout.socketPath).then((alive) => {
            if (alive) {
                process.stderr.write(`[agent-tracer-daemon] already running at ${layout.socketPath} — exiting\n`);
                process.exit(0);
            }
            try {
                fs.unlinkSync(layout.socketPath);
            } catch {
                // already gone
            }
            listenOnSocket();
        });
        return;
    }
    process.stderr.write(`[agent-tracer-daemon] server error: ${String(err)}\n`);
    process.exit(1);
});

listenOnSocket();

const idleTimer = setInterval(() => {
    if (shuttingDown) return;
    if (queue.length > 0 || processing) {
        lastActivityAt = Date.now();
        return;
    }
    if (Date.now() - lastActivityAt < IDLE_SHUTDOWN_MS) return;
    process.stderr.write(`[agent-tracer-daemon] idle ${IDLE_SHUTDOWN_MS}ms — exiting\n`);
    void gracefulShutdown("idle-timeout");
}, 30_000);
idleTimer.unref();

process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => void gracefulShutdown("SIGINT"));
