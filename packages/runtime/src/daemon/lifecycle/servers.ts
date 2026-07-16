import * as fs from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {daemonLog} from "~runtime/daemon/daemon.log.js";
import {RESUME_PATH} from "~runtime/daemon/control/resume.http.js";
import {DAEMON_SOCKET_MODE, probeSocket} from "~runtime/daemon/ipc/socket.client.js";
import {writeDaemonPid} from "~runtime/daemon/lifecycle/daemon.pid.js";

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
        // 라우팅은 접두어로 갈라 재개 핸들러에 OPTIONS까지 넘기고, 정확한 경로 판정은 그 핸들러가 한다.
        if ((request.url ?? "").startsWith(RESUME_PATH)) options.resumeHandler(request, response);
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
        daemonLog(`listening at ${options.paths.socketPath} (pid=${process.pid})`);
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
        daemonLog(`server error: ${String(error)}`);
        process.exit(1);
    });

    httpServer.on("listening", () => {
        httpServer.unref();
        daemonLog(`control page at http://127.0.0.1:${options.controlPort}/`);
    });

    httpServer.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" || options.isShuttingDown()) {
            daemonLog(`control server error: ${String(error)}`);
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
        daemonLog(`already running at ${options.paths.socketPath} — exiting`);
        process.exit(0);
    }
    try {
        fs.unlinkSync(options.paths.socketPath);
    } catch {
        // 다른 프로세스가 같은 소켓 경로를 먼저 회수할 수 있다.
    }
    listenOnSocket();
}
