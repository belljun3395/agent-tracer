import * as fs from "node:fs";
import * as path from "node:path";
import { PROJECT_DIR } from "./paths.js";
import { isRecord } from "./utils.js";

export interface SubagentRegistryEntry {
    parentSessionId: string;
    agentType: string;
    linked: boolean;
    parentTaskId?: string;
}

export type SubagentRegistry = Record<string, SubagentRegistryEntry>;

const SUBAGENT_REGISTRY_FILE = path.join(PROJECT_DIR, ".claude", ".subagent-registry.json");

export function readSubagentRegistry(): SubagentRegistry {
    try {
        const raw = fs.readFileSync(SUBAGENT_REGISTRY_FILE, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        return isRecord(parsed) ? (parsed as SubagentRegistry) : {};
    } catch {
        return {};
    }
}

export function writeSubagentRegistry(registry: SubagentRegistry): void {
    try {
        fs.writeFileSync(SUBAGENT_REGISTRY_FILE, JSON.stringify(registry, null, 2));
    } catch {
        void 0;
    }
}
