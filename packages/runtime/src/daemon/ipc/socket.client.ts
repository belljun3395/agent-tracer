import * as net from "node:net";
import type {DaemonRequest} from "~runtime/daemon/port/daemon.socket.port.js";

export const DAEMON_SOCKET_MODE = 0o600;

const SOCKET_CONNECT_TIMEOUT_MS = 200;

/** 유닉스 소켓 연결 성공 여부로 데몬 생존을 확인한다. */
export function probeSocket(socketPath: string, timeoutMs = SOCKET_CONNECT_TIMEOUT_MS): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.createConnection(socketPath);
        let settled = false;
        const finish = (alive: boolean): void => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(alive);
        };
        socket.setTimeout(timeoutMs, () => finish(false));
        socket.once("error", () => finish(false));
        socket.once("connect", () => finish(true));
    });
}

/** 데몬 소켓에 개행으로 끝나는 JSON 요청 한 줄을 보내고 응답 한 줄을 받는다. */
export function requestDaemon<TMessage extends DaemonRequest, T>(
    socketPath: string,
    message: TMessage,
    timeoutMs: number,
    parse: (parsed: unknown) => T,
    empty: T,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(socketPath);
        let buffer = "";
        let settled = false;
        const finish = (value: T | undefined, error?: Error): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.destroy();
            if (error) reject(error);
            else resolve(value ?? empty);
        };
        const timer = setTimeout(
            () => finish(undefined, new Error(`daemon ${message.type} timeout`)),
            timeoutMs,
        );
        socket.once("error", (error) => finish(undefined, error));
        socket.once("connect", () => {
            socket.write(`${JSON.stringify(message)}\n`);
        });
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            const index = buffer.indexOf("\n");
            if (index === -1) return;
            const line = buffer.slice(0, index).trim();
            try {
                finish(parse(JSON.parse(line)));
            } catch {
                finish(empty);
            }
        });
    });
}
