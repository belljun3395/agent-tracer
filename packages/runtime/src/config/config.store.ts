import * as fs from "node:fs";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {isRecord} from "~runtime/support/json.js";

/** `config.json` 전체 레코드이며 알려진 키 밖의 값도 그대로 보존한다. */
export function readAgentTracerConfig(
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(paths.configPath, "utf8"));
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/** 기존 레코드에 `next`를 얹어 한 번에 쓰므로 두 writer가 서로의 필드를 지우지 않는다. */
export function writeAgentTracerConfig(
    next: Record<string, unknown>,
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): void {
    const merged = {...readAgentTracerConfig(paths), ...next};
    fs.writeFileSync(paths.configPath, `${JSON.stringify(merged, null, 2)}\n`, {mode: 0o600});
}
