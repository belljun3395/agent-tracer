import * as fs from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {DAEMON_SOCKET_MODE, probeSocket} from "~runtime/daemon/ipc/socket.client.js";
import {writeDaemonPid} from "~runtime/daemon/lifecycle/daemon.pid.js";

const RESUME_PATH_PREFIX = "/api/v1/resume";

interface DaemonServerOptions {
    readonly paths: AgentTracerPaths;
    readonly controlPort: number;
    readonly rebindRetryMs: number;
    readonly onConnection: (socket: net.Socket) => void;
    readonly resumeHandler: http.RequestListener;
    readonly controlHandler: http.RequestListener;
    readonly onActivity: () => void;
    readonly onSocketReady: () => void;
    readonly isShuttingDown: () => boolean;
}

export interface DaemonServers {
    readonly start: () => void;
    readonly close: () => void;
}

/** 데몬의 유닉스 소켓과 제어 화면 HTTP 서버의 수명 주기를 관리한다. */
export function createDaemonServers(options: DaemonServerOptions): DaemonServers {
    const socketServer = net.createServer(options.onConnection);
    const httpServer = http.createServer((request, response) => {
        options.onActivity();
        if ((request.url ?? "").startsWith(RESUME_PATH_PREFIX)) options.resumeHandler(request, response);
        else options.controlHandler(request, response);
    });

    const listenOnSocket = (): void => {
        socketServer.listen({path: options.paths.socketPath, exclusive: true});
    };
    const listenOnControl = (): void => {
        httpServer.listen(options.controlPort, "127.0.0.1");
    };

    socketServer.on("listening", () => {
        try {
            fs.chmodSync(options.paths.socketPath, DAEMON_SOCKET_MODE);
        } catch {
            // 소켓 파일의 권한 변경은 파일 시스템 지원 여부에 달려 있다.
        }
        writeDaemonPid(options.paths);
        process.stderr.write(
            `[agent-tracer-daemon] listening at ${options.paths.socketPath} (pid=${process.pid})\n`,
        );
        options.onSocketReady();
        listenOnControl();
    });

    let reclaimAttempted = false;
    socketServer.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code === "EADDRINUSE" && !reclaimAttempted) {
            reclaimAttempted = true;
            void reclaimSocket(options, listenOnSocket);
            return;
        }
        process.stderr.write(`[agent-tracer-daemon] server error: ${String(error)}\n`);
        process.exit(1);
    });

    httpServer.on("listening", () => {
        httpServer.unref();
        process.stderr.write(`[agent-tracer-daemon] control page at http://127.0.0.1:${options.controlPort}/\n`);
    });

    httpServer.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" || options.isShuttingDown()) {
            process.stderr.write(`[agent-tracer-daemon] control server error: ${String(error)}\n`);
            return;
        }
        const retry = setTimeout(() => {
            if (!options.isShuttingDown()) listenOnControl();
        }, options.rebindRetryMs);
        retry.unref();
    });

    return {
        start: listenOnSocket,
        close: () => {
            socketServer.close();
            if (httpServer.listening) httpServer.close();
        },
    };
}

async function reclaimSocket(options: DaemonServerOptions, listenOnSocket: () => void): Promise<void> {
    if (await probeSocket(options.paths.socketPath, 100)) {
        process.stderr.write(
            `[agent-tracer-daemon] already running at ${options.paths.socketPath} — exiting\n`,
        );
        process.exit(0);
    }
    try {
        fs.unlinkSync(options.paths.socketPath);
    } catch {
        // 다른 프로세스가 같은 소켓 경로를 먼저 회수할 수 있다.
    }
    listenOnSocket();
}
