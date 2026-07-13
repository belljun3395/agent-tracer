import * as fs from "node:fs";
import {ensureAgentTracerHome, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import type {BindingStore} from "~runtime/domain/binding/model/binding.model.js";
import type {BindingStorePort} from "~runtime/domain/binding/port/binding.store.port.js";
import {isRecord} from "~runtime/support/json.js";

const LOCK_TIMEOUT_MS = 1000;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 20;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 바인딩을 홈 디렉터리의 JSON 파일에 두고 잠금 디렉터리로 훅 사이 경합을 막는다. */
export class FileBindingStoreAdapter implements BindingStorePort {
    constructor(private readonly paths: AgentTracerPaths = resolveAgentTracerPaths()) {
        ensureAgentTracerHome(this.paths);
    }

    read(): BindingStore {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(this.paths.bindingsPath, "utf8"));
            return isRecord(parsed) ? (parsed as BindingStore) : {};
        } catch {
            return {};
        }
    }

    write(store: BindingStore): void {
        ensureAgentTracerHome(this.paths);
        const tmp = `${this.paths.bindingsPath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(store));
        fs.renameSync(tmp, this.paths.bindingsPath);
    }

    async acquireLock(): Promise<boolean> {
        const deadline = Date.now() + LOCK_TIMEOUT_MS;
        for (;;) {
            try {
                fs.mkdirSync(this.paths.bindingsLockPath);
                return true;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "EEXIST") return false;
                if (this.clearStaleLock()) continue;
                if (Date.now() >= deadline) return false;
                await delay(LOCK_RETRY_MS);
            }
        }
    }

    releaseLock(): void {
        try {
            fs.rmdirSync(this.paths.bindingsLockPath);
        } catch {
            return;
        }
    }

    private clearStaleLock(): boolean {
        try {
            const stat = fs.statSync(this.paths.bindingsLockPath);
            if (Date.now() - stat.mtimeMs <= LOCK_STALE_MS) return false;
            fs.rmdirSync(this.paths.bindingsLockPath);
            return true;
        } catch {
            return false;
        }
    }
}
