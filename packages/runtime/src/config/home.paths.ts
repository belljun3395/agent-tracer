import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const HOME_DIRNAME = ".agent-tracer";
const HOME_MODE = 0o700;

/** 로컬 상태 루트와 그 하위 파일 경로다. */
export interface AgentTracerPaths {
    readonly homeDir: string;
    readonly spoolDir: string;
    readonly deadPath: string;
    readonly cacheDir: string;
    readonly configPath: string;
    readonly bindingsPath: string;
    readonly bindingsLockPath: string;
    readonly recipePendingPath: string;
    readonly socketPath: string;
    readonly logPath: string;
    readonly resumeTokenPath: string;
    readonly pidPath: string;
}

export function resolveAgentTracerPaths(env: NodeJS.ProcessEnv = process.env): AgentTracerPaths {
    const home = env.HOME && env.HOME.trim() ? env.HOME : os.homedir();
    const homeDir = path.join(home, HOME_DIRNAME);
    const spoolDir = path.join(homeDir, "spool");
    const cacheDir = path.join(homeDir, "cache");
    const explicitSocket = (env.AGENT_TRACER_DAEMON_SOCKET ?? "").trim();
    return {
        homeDir,
        spoolDir,
        deadPath: path.join(spoolDir, "dead.jsonl"),
        cacheDir,
        configPath: path.join(homeDir, "config.json"),
        bindingsPath: path.join(homeDir, "bindings.json"),
        bindingsLockPath: path.join(homeDir, "bindings.lock"),
        recipePendingPath: path.join(homeDir, "recipe-pending.json"),
        socketPath: explicitSocket || path.join(homeDir, "daemon.sock"),
        logPath: path.join(homeDir, "daemon.log"),
        resumeTokenPath: path.join(homeDir, "resume.token"),
        pidPath: path.join(homeDir, "daemon.pid"),
    };
}

function mkdirSecure(dir: string): void {
    fs.mkdirSync(dir, {recursive: true, mode: HOME_MODE});
    try {
        fs.chmodSync(dir, HOME_MODE);
    } catch {
        // POSIX는 mkdir 시점에 권한을 적용하므로 실패해도 무해하다.
    }
}

export function ensureAgentTracerHome(paths: AgentTracerPaths = resolveAgentTracerPaths()): void {
    mkdirSecure(paths.homeDir);
}

export function ensureSpoolDir(paths: AgentTracerPaths = resolveAgentTracerPaths()): void {
    mkdirSecure(paths.homeDir);
    mkdirSecure(paths.spoolDir);
}
