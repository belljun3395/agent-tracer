import * as fs from "node:fs";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {listSpoolSegments, SPOOL_MAX_BYTES} from "~runtime/config/spool.js";
import {readDeadLetter, type DeadLetterReport} from "~runtime/config/dead.letter.js";
import type {SendOutcome} from "~runtime/daemon/delivery/ingest.retry.js";
import type {SpoolSenderState} from "~runtime/daemon/delivery/spool.sender.js";
import type {InterventionSnapshot, RuleActivity} from "~runtime/daemon/observation/intervention.log.js";
import type {RecentEventStats} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {describeRuleExpectation} from "~runtime/domain/guardrail/model/rules.context.model.js";

export type PipelineStatus = "ok" | "idle" | "retrying" | "rejecting" | "unreachable";

/** 서버에서 당겨와 캐싱 중인 값의 신선도다. */
export interface CacheFreshness {
    readonly lastRefreshAt: number | null;
    readonly lastFailureAt: number | null;
    readonly intervalMs: number;
    readonly entries: number;
}

export interface DaemonCaches {
    readonly rules: CacheFreshness;
    readonly recipes: CacheFreshness;
    readonly autoRuleGeneration: boolean;
}

/** 제어 스냅샷을 조립할 때 데몬이 넘기는 현재 상태다. */
export interface DaemonRuntimeState extends SpoolSenderState {
    readonly version: string;
    readonly hookVersion: string | null;
    readonly pid: number;
    readonly startedAt: number;
    readonly entryPath: string;
    readonly baseUrl: string;
    readonly activeConnections: number;
    readonly lastActivityAt: number;
    readonly idleShutdownMs: number;
    readonly swallowedErrors: number;
    readonly rules: readonly GuardrailRule[];
    readonly caches: DaemonCaches;
    readonly ring: RecentEventStats;
    readonly interventions: InterventionSnapshot;
}

export interface SpoolView {
    readonly segments: number;
    readonly backlogBytes: number;
    readonly capBytes: number;
    readonly poisonSegment: string | null;
    readonly poisonAttempts: number;
    readonly poisonThreshold: number;
}

/** 캐시된 규칙과 그 발동 통계를 합친 제어 화면 행이다. */
export interface RuleView {
    readonly ruleName: string;
    readonly taskId: string | null;
    readonly severity: string;
    readonly reviewState: string;
    readonly expectation: string;
    readonly cached: boolean;
    readonly evaluated: number;
    readonly satisfied: number;
    readonly unfulfilled: number;
    readonly unknown: number;
    readonly blocked: number;
    readonly lastFiredAt?: number;
}

export interface ControlSnapshot {
    readonly now: number;
    readonly status: PipelineStatus;
    readonly versionSkew: boolean;
    readonly daemon: {
        readonly version: string;
        readonly hookVersion: string | null;
        readonly pid: number;
        readonly uptimeMs: number;
        readonly entryPath: string;
        readonly socketPath: string;
        readonly baseUrl: string;
        readonly activeConnections: number;
        readonly idleInMs: number;
        readonly swallowedErrors: number;
    };
    readonly transport: {
        readonly backoffMs: number;
        readonly retryStatusSince: number | null;
        readonly lastSendAt: number | null;
        readonly lastSendOutcome: SendOutcome | null;
        readonly lastDeadReason: string | null;
    };
    readonly spool: SpoolView;
    readonly deadLetter: DeadLetterReport;
    readonly caches: DaemonCaches;
    readonly bindingsBytes: number;
    readonly ring: RecentEventStats;
    readonly interventions: InterventionSnapshot;
    readonly rules: readonly RuleView[];
}

const DEAD_LETTER_PAGE = 100;

export function resolvePipelineStatus(state: DaemonRuntimeState, pendingSegments: number): PipelineStatus {
    if (state.retryStatusSince !== null) return "retrying";
    if (state.lastSendOutcome === "unreachable") return "unreachable";
    if (state.lastSendOutcome === "dead") return "rejecting";
    if (state.backoffMs > 0) return "retrying";
    return pendingSegments > 0 ? "ok" : "idle";
}

function fileBytes(filePath: string): number {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

function belongsTo(rule: GuardrailRule, item: RuleActivity): boolean {
    return item.ruleName === rule.name && rule.taskId === item.taskId;
}

function sum(stats: readonly RuleActivity[], pick: (stat: RuleActivity) => number): number {
    return stats.reduce((total, stat) => total + pick(stat), 0);
}

function joinRules(rules: readonly GuardrailRule[], activity: readonly RuleActivity[]): RuleView[] {
    const claimed = new Set<RuleActivity>();
    const views: RuleView[] = rules.map((rule) => {
        const stats = activity.filter((item) => belongsTo(rule, item));
        for (const stat of stats) claimed.add(stat);
        const lastFiredAt = stats
            .map((stat) => stat.lastFiredAt)
            .filter((at): at is number => at !== undefined)
            .reduce<number | undefined>((max, at) => (max === undefined || at > max ? at : max), undefined);
        return {
            ruleName: rule.name,
            taskId: rule.taskId,
            severity: rule.severity,
            reviewState: rule.reviewState,
            expectation: describeRuleExpectation(rule),
            cached: true,
            evaluated: sum(stats, (stat) => stat.evaluated),
            satisfied: sum(stats, (stat) => stat.satisfied),
            unfulfilled: sum(stats, (stat) => stat.unfulfilled),
            unknown: sum(stats, (stat) => stat.unknown),
            blocked: sum(stats, (stat) => stat.blocked),
            ...(lastFiredAt !== undefined ? {lastFiredAt} : {}),
        };
    });
    for (const orphan of activity) {
        if (claimed.has(orphan)) continue;
        views.push({
            ...orphan,
            severity: "unknown",
            reviewState: "unknown",
            expectation: "unknown",
            cached: false,
        });
    }
    views.sort((a, b) => b.blocked - a.blocked || b.evaluated - a.evaluated);
    return views;
}

/** 데몬 상태와 디스크에 있는 스풀·dead-letter를 합쳐 제어 화면이 읽는 스냅샷을 만든다. */
export function buildControlSnapshot(
    state: DaemonRuntimeState,
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
    now: number = Date.now(),
): ControlSnapshot {
    const segments = listSpoolSegments(paths);
    const backlogBytes = segments.reduce((total, segment) => total + segment.size, 0);
    return {
        now,
        status: resolvePipelineStatus(state, segments.length),
        versionSkew: state.hookVersion !== null && state.hookVersion !== state.version,
        daemon: {
            version: state.version,
            hookVersion: state.hookVersion,
            pid: state.pid,
            uptimeMs: now - state.startedAt,
            entryPath: state.entryPath,
            socketPath: paths.socketPath,
            baseUrl: state.baseUrl,
            activeConnections: state.activeConnections,
            idleInMs: Math.max(0, state.idleShutdownMs - (now - state.lastActivityAt)),
            swallowedErrors: state.swallowedErrors,
        },
        transport: {
            backoffMs: state.backoffMs,
            retryStatusSince: state.retryStatusSince,
            lastSendAt: state.lastSendAt,
            lastSendOutcome: state.lastSendOutcome,
            lastDeadReason: state.lastDeadReason,
        },
        spool: {
            segments: segments.length,
            backlogBytes,
            capBytes: SPOOL_MAX_BYTES,
            poisonSegment: state.poisonSegment,
            poisonAttempts: state.poisonAttempts,
            poisonThreshold: state.poisonThreshold,
        },
        deadLetter: readDeadLetter(DEAD_LETTER_PAGE, paths),
        caches: state.caches,
        bindingsBytes: fileBytes(paths.bindingsPath),
        ring: state.ring,
        interventions: state.interventions,
        rules: joinRules(state.rules, state.interventions.ruleActivity),
    };
}
