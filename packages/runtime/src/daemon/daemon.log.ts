const DAEMON_LOG_PREFIX = "[agent-tracer-daemon]";

/** 데몬의 모든 진단 로그가 지나는 통로이며 접두어와 개행을 여기서만 소유한다. */
export function daemonLog(message: string): void {
    process.stderr.write(`${DAEMON_LOG_PREFIX} ${message}\n`);
}
