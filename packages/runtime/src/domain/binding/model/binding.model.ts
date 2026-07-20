import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";

const MAX_BINDINGS = 1000;

/** 런타임 세션 하나가 붙잡고 있는 태스크와 세션과 진행 중인 턴이다. */
export interface BindingRecord {
    readonly taskId: string;
    readonly sessionId: string;
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly workspacePath?: string;
    /** 이 바인딩을 만든 런타임 프로세스이며, /clear를 가로질러 같은 창을 가리키는 유일한 신원이다. */
    readonly runtimePid?: number;
    /** /clear로 이 세션을 밀어낸 후임 런타임 세션이며, 낡은 식별자를 현재 바인딩으로 잇는다. */
    readonly supersededBy?: string;
    readonly createdAt: string;
    readonly titled?: boolean;
    readonly resumed?: boolean;
    readonly currentTurnId?: string;
    readonly turnStartedAt?: string;
    readonly previousTurnId?: string;
    readonly turnPrompt?: string;
}

export type BindingStore = Record<string, BindingRecord>;

/** 턴 경계를 여닫는 훅이 공유 바인딩에 남기는 변경분이다. */
export interface TurnPatch {
    readonly currentTurnId?: string;
    readonly turnStartedAt?: string;
    readonly previousTurnId?: string;
    readonly turnPrompt?: string;
}

/** 단명 훅 사이에서 공유되는 현재 턴 상태다. */
export interface TurnState {
    readonly turnId: string;
    readonly startedAt: string;
    readonly previousTurnId?: string;
    readonly prompt?: string;
}

export function bindingKey(runtimeSource: string, runtimeSessionId: string): string {
    return `${runtimeSource}::${runtimeSessionId}`;
}

/** 바인딩 저장소를 최근 항목 상한으로 제한한다. */
export function capBindingStore(bindings: BindingStore): BindingStore {
    const entries = Object.entries(bindings);
    if (entries.length <= MAX_BINDINGS) return bindings;
    entries.sort((left, right) => left[1].createdAt.localeCompare(right[1].createdAt));
    return Object.fromEntries(entries.slice(entries.length - MAX_BINDINGS));
}

/** 바인딩에 열린 턴이 있으면 턴 상태로 투영한다. */
export function turnStateOf(binding: BindingRecord | undefined): TurnState | undefined {
    if (!binding?.currentTurnId) return undefined;
    return {
        turnId: binding.currentTurnId,
        startedAt: binding.turnStartedAt ?? binding.createdAt,
        ...(binding.previousTurnId ? {previousTurnId: binding.previousTurnId} : {}),
        ...(binding.turnPrompt ? {prompt: binding.turnPrompt} : {}),
    };
}

/** 런타임 세션이 붙잡고 있는 태스크와 세션과 열린 턴이다. */
export interface BoundSession extends IngestTarget {
    readonly startedAt: string;
    readonly turn?: TurnState;
}

export function toBoundSession(binding: BindingRecord): BoundSession {
    const turn = turnStateOf(binding);
    return {
        taskId: binding.taskId,
        sessionId: binding.sessionId,
        startedAt: binding.createdAt,
        ...(turn ? {turnId: turn.turnId, turn} : {}),
    };
}

function activityTimestamp(binding: BindingRecord): number {
    return Date.parse(binding.turnStartedAt ?? binding.createdAt);
}

/** MCP 서버 프로세스는 /clear를 살아남아 옛 세션 식별자를 그대로 들고 오므로 승계를 따라 현재 바인딩까지 간다. */
export function resolveLiveBinding(
    bindings: BindingStore,
    runtimeSource: string,
    runtimeSessionId: string,
): BindingRecord | undefined {
    const seen = new Set<string>();
    let key = bindingKey(runtimeSource, runtimeSessionId);
    let binding = bindings[key];
    while (binding?.supersededBy !== undefined) {
        if (seen.has(key)) return undefined;
        seen.add(key);
        key = bindingKey(runtimeSource, binding.supersededBy);
        const next = bindings[key];
        if (next === undefined) return undefined;
        binding = next;
    }
    return binding;
}

/** 조건을 만족하는 바인딩 중 가장 최근에 턴이 열린 것을 고른다. */
export function mostRecentBindingWhere(
    bindings: BindingStore,
    predicate: (binding: BindingRecord) => boolean,
): BindingRecord | undefined {
    const matches = Object.values(bindings).filter(predicate);
    if (matches.length === 0) return undefined;
    return matches.reduce((latest, candidate) => (
        activityTimestamp(candidate) > activityTimestamp(latest) ? candidate : latest
    ));
}
