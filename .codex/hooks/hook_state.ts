import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
    PROJECT_DIR,
    hookLog,
    isRecord,
    toTrimmedString
} from "./common.js";

export interface HookState {
    readonly processedTurnsBySession: Record<string, string[]>;
    readonly pendingUserPromptHashesBySession: Record<string, string[]>;
}

const STATE_FILE_NAME = ".hook-state.json";
const MAX_HISTORY = 200;

export function readHookState(): HookState {
    const filename = stateFilePath();
    try {
        const raw = fs.readFileSync(filename, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) return emptyHookState();

        return {
            processedTurnsBySession: readStringArrayRecord(parsed.processedTurnsBySession),
            pendingUserPromptHashesBySession: readStringArrayRecord(parsed.pendingUserPromptHashesBySession)
        };
    } catch {
        return emptyHookState();
    }
}

export function writeHookState(state: HookState): void {
    const filename = stateFilePath();
    try {
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, JSON.stringify(state, null, 2));
    } catch (error) {
        hookLog("hook_state", "failed to write hook state", { error: String(error) });
    }
}

export function isTurnAlreadyProcessed(state: HookState, runtimeSessionId: string, turnId: string): boolean {
    const turns = state.processedTurnsBySession[runtimeSessionId] ?? [];
    return turns.includes(turnId);
}

export function markTurnProcessed(state: HookState, runtimeSessionId: string, turnId: string): HookState {
    const turns = state.processedTurnsBySession[runtimeSessionId] ?? [];
    const merged = turns.includes(turnId)
        ? turns
        : [...turns, turnId];

    return {
        ...state,
        processedTurnsBySession: {
            ...state.processedTurnsBySession,
            [runtimeSessionId]: merged.slice(Math.max(0, merged.length - MAX_HISTORY))
        }
    };
}

export function queuePendingUserPrompt(state: HookState, runtimeSessionId: string, prompt: string): HookState {
    const promptHash = hashPrompt(prompt);
    if (!runtimeSessionId || !promptHash) return state;

    const prompts = state.pendingUserPromptHashesBySession[runtimeSessionId] ?? [];
    const merged = [...prompts, promptHash];

    return {
        ...state,
        pendingUserPromptHashesBySession: {
            ...state.pendingUserPromptHashesBySession,
            [runtimeSessionId]: merged.slice(Math.max(0, merged.length - MAX_HISTORY))
        }
    };
}

export function consumePendingUserPrompt(
    state: HookState,
    runtimeSessionId: string,
    prompt: string
): { readonly matched: boolean; readonly state: HookState } {
    const promptHash = hashPrompt(prompt);
    if (!runtimeSessionId || !promptHash) {
        return { matched: false, state };
    }

    const prompts = [...(state.pendingUserPromptHashesBySession[runtimeSessionId] ?? [])];
    const matchIndex = prompts.indexOf(promptHash);
    if (matchIndex < 0) {
        return { matched: false, state };
    }

    prompts.splice(matchIndex, 1);
    return {
        matched: true,
        state: {
            ...state,
            pendingUserPromptHashesBySession: {
                ...state.pendingUserPromptHashesBySession,
                [runtimeSessionId]: prompts
            }
        }
    };
}

function emptyHookState(): HookState {
    return {
        processedTurnsBySession: {},
        pendingUserPromptHashesBySession: {}
    };
}

function readStringArrayRecord(value: unknown): Record<string, string[]> {
    if (!isRecord(value)) return {};

    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
            key,
            Array.isArray(entry)
                ? entry.map((item) => toTrimmedString(item)).filter(Boolean)
                : []
        ])
    );
}

function hashPrompt(prompt: string): string {
    const normalized = toTrimmedString(prompt, 100_000);
    if (!normalized) return "";
    return crypto.createHash("sha1").update(normalized).digest("hex");
}

function stateFilePath(): string {
    return path.join(PROJECT_DIR, ".codex", STATE_FILE_NAME);
}
