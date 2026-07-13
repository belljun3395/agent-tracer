import * as fs from "node:fs";
import type {AgentTracerPaths} from "~runtime/config/home.paths.js";

const PID_FILE_MODE = 0o600;

/** 소켓 프로토콜을 모르는 데몬도 훅이 강제 종료할 수 있도록 pid 파일을 남긴다. */
export function writeDaemonPid(paths: AgentTracerPaths, pid: number = process.pid): void {
    try {
        fs.writeFileSync(paths.pidPath, `${pid}\n`, {mode: PID_FILE_MODE});
    } catch {
        return;
    }
}

/** pid 파일은 소켓을 마지막으로 바인드한 데몬의 소유권 표식이다. */
export function ownsDaemonPid(paths: AgentTracerPaths): boolean {
    return readPidFile(paths) === process.pid;
}

/** 자기가 주인일 때만 pid 파일을 지운다. */
export function removeDaemonPid(paths: AgentTracerPaths): void {
    if (!ownsDaemonPid(paths)) return;
    try {
        fs.unlinkSync(paths.pidPath);
    } catch {
        return;
    }
}

/** 죽은 데몬의 pid는 다른 프로세스에 재활용됐을 수 있으므로 살아 있는 pid만 낸다. */
export function readDaemonPid(paths: AgentTracerPaths): number | undefined {
    const pid = readPidFile(paths);
    if (pid === undefined || pid === process.pid) return undefined;
    return isProcessAlive(pid) ? pid : undefined;
}

function readPidFile(paths: AgentTracerPaths): number | undefined {
    let raw: string;
    try {
        raw = fs.readFileSync(paths.pidPath, "utf8");
    } catch {
        return undefined;
    }
    const pid = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        // EPERM은 프로세스가 살아 있으나 다른 사용자 소유라는 뜻이다.
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
}
