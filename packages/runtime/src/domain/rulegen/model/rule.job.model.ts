import {
    RULE_GENERATION_FOCUS,
    normalizeRuleGenerationIntent,
    type RuleGenerationFocus,
} from "@monitor/kernel/job/job.const.js";
import type {RuleProposalPayload} from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import type {RuleGenerationRequest} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";

/** 서버가 내려주는 대기 중 규칙 생성 잡이다. */
export interface PendingRuleJob {
    readonly id: string;
    readonly taskId: string | null;
    readonly input?: {
        readonly focus?: string;
        readonly maxRules?: number;
        readonly intent?: unknown;
        readonly anchorEventId?: string;
    };
}

/** 잡을 계속 쥐고 있어도 되는지 알려주는 리스 상태다. */
export interface RuleJobLeaseState {
    readonly leaseHeld: boolean;
    readonly canceled: boolean;
}

export interface RuleGenerationUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreationTokens: number;
}

/** 실행기가 명세를 돌리고 돌려주는 원시 결과다. */
export interface RuleGenerationOutcome {
    readonly candidates: readonly unknown[];
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: RuleGenerationUsage | null;
    readonly error: string | null;
}

/** 서버에 보고하는 규칙 생성 결과다. */
export interface RuleGenerationReport {
    readonly proposals: readonly RuleProposalPayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage?: RuleGenerationUsage;
}

/** 폴러가 클레임한 잡 하나를 끝까지 처리하는 실행 경로다. */
export type RuleJobRunner = (request: RuleGenerationRequest, signal: AbortSignal) => Promise<void>;

export function readJobFocus(job: PendingRuleJob): RuleGenerationFocus | undefined {
    return job.input?.focus === RULE_GENERATION_FOCUS.recent ? RULE_GENERATION_FOCUS.recent : undefined;
}

export function readJobMaxRules(job: PendingRuleJob): number | undefined {
    const value = job.input?.maxRules;
    return typeof value === "number" ? value : undefined;
}

export function readJobIntent(job: PendingRuleJob): string | undefined {
    return normalizeRuleGenerationIntent(job.input?.intent);
}

export function readJobAnchorEventId(job: PendingRuleJob): string | undefined {
    const value = job.input?.anchorEventId;
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export interface RuleJobContext {
    readonly workspacePath: string;
    readonly anchorText?: string;
}

export function toRuleGenerationRequest(
    job: PendingRuleJob,
    taskId: string,
    context: RuleJobContext,
): RuleGenerationRequest {
    const focus = readJobFocus(job);
    const maxRules = readJobMaxRules(job);
    const intent = readJobIntent(job);
    return {
        jobId: job.id,
        taskId,
        workspacePath: context.workspacePath,
        ...(focus !== undefined ? {focus} : {}),
        ...(maxRules !== undefined ? {maxRules} : {}),
        ...(intent !== undefined ? {intent} : {}),
        ...(context.anchorText !== undefined ? {anchorText: context.anchorText} : {}),
    };
}
