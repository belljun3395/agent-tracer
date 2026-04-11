/**
 * File-system backed subagent registry.
 *
 * Tracks in-flight subagent sessions so ensure_task.ts can link a subagent's
 * child session to its parent task in the monitor.
 *
 * Lifecycle:
 *   SubagentStart (subagent_lifecycle.ts) — writes an entry keyed by agent_id.
 *   ensure_task.ts (PreToolUse)           — reads the entry to link the session.
 *   SubagentStop  (subagent_lifecycle.ts) — deletes the entry on completion.
 *
 * Registry location: <PROJECT_DIR>/.claude/.subagent-registry.json
 * The registry is a flat JSON object: { [agent_id]: SubagentRegistryEntry }
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PROJECT_DIR } from "../util/paths.js";
import { isRecord } from "../util/utils.js";

export interface SubagentRegistryEntry {
    parentSessionId: string;
    agentType: string;
    linked: boolean;
    parentTaskId?: string;
    childTaskId?: string;
    childSessionId?: string;
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
