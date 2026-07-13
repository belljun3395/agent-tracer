import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
    AiJobGraphEventKind,
    AiJobStepPayload,
    AiJobStepRole,
    AiJobStepToolCall,
} from "@monitor/kernel";
import { AI_JOB_STEP_ROLE, aiJobStepCarriesContent } from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";

export interface AiJobStepCreateInput {
    // 호출부(generate 활동)가 확정한 id. generate는 성공하면 워크플로 히스토리에 커밋되어
    // 재실행되지 않으므로, finalize가 재시도돼도 같은 id로 upsert되어 (job_id, attempt, seq)
    // 유니크 인덱스와 충돌하지 않는다.
    readonly id: string;
    readonly jobId: string;
    readonly userId: string;
    // Temporal 활동 재시도 회차이며, 시도마다 seq가 0부터 다시 시작해도 이 값으로 분리되어 충돌하지 않는다.
    readonly attempt: number;
    readonly step: AiJobStepPayload;
    readonly now: Date;
}

// recipe-scan 등 도구 순환 루프가 있는 잡의 궤적을 잡당 순서 있는 행으로 남기며, 실패한 시도의 궤적도 attempt로 분리해 같이 남는다.
@Entity({ name: "ai_job_steps" })
@Index("ai_job_steps_job_attempt_seq", ["jobId", "attempt", "seq"], { unique: true })
@Index("ai_job_steps_user_created", ["userId", "createdAt"])
export class AiJobStepEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "integer", default: 1 })
    attempt!: number;

    @Column({ type: "integer" })
    seq!: number;

    @Column({ type: "text" })
    role!: AiJobStepRole;

    @Column({ type: "text" })
    content!: string;

    @Column({ type: "boolean", default: false })
    truncated!: boolean;

    @Column({ name: "tool_calls", type: "jsonb", nullable: true })
    toolCalls!: AiJobStepToolCall[] | null;

    @Column({ name: "tool_name", type: "text", nullable: true })
    toolName!: string | null;

    @Column({ name: "tool_call_id", type: "text", nullable: true })
    toolCallId!: string | null;

    @Column({ name: "input_tokens", type: "integer", nullable: true })
    inputTokens!: number | null;

    @Column({ name: "output_tokens", type: "integer", nullable: true })
    outputTokens!: number | null;

    @Column({ name: "cache_read_tokens", type: "integer", nullable: true })
    cacheReadTokens!: number | null;

    @Column({ name: "cache_creation_tokens", type: "integer", nullable: true })
    cacheCreationTokens!: number | null;

    @Column({ name: "stop_reason", type: "text", nullable: true })
    stopReason!: string | null;

    @Column({ name: "node_name", type: "text", nullable: true })
    nodeName!: string | null;

    @Column({ name: "event_kind", type: "text", nullable: true })
    eventKind!: AiJobGraphEventKind | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    static create(input: AiJobStepCreateInput): AiJobStepEntity {
        if (input.id.trim().length === 0) throw new InvariantViolationError("ai-job-step.empty-id");
        if (input.jobId.trim().length === 0) throw new InvariantViolationError("ai-job-step.empty-job");
        if (input.userId.trim().length === 0) throw new InvariantViolationError("ai-job-step.empty-user");
        if (input.step.seq < 0) throw new InvariantViolationError("ai-job-step.negative-seq");
        if (!aiJobStepCarriesContent(input.step)) {
            throw new InvariantViolationError("ai-job-step.empty-content");
        }

        const step = new AiJobStepEntity();
        step.id = input.id;
        step.jobId = input.jobId;
        step.userId = input.userId;
        step.attempt = input.attempt;
        step.seq = input.step.seq;
        step.role = input.step.role;
        step.content = input.step.content;
        step.truncated = input.step.truncated;
        step.toolCalls = input.step.toolCalls.length > 0 ? [...input.step.toolCalls] : null;
        step.toolName = input.step.toolName ?? null;
        step.toolCallId = input.step.toolCallId ?? null;
        step.inputTokens = input.step.inputTokens ?? null;
        step.outputTokens = input.step.outputTokens ?? null;
        step.cacheReadTokens = input.step.cacheReadTokens ?? null;
        step.cacheCreationTokens = input.step.cacheCreationTokens ?? null;
        step.stopReason = input.step.stopReason ?? null;
        step.nodeName = input.step.nodeName ?? null;
        step.eventKind = input.step.eventKind ?? null;
        step.durationMs = input.step.durationMs ?? null;
        step.createdAt = input.now;
        return step;
    }

    // 어시스턴트가 이 스텝에서 도구를 호출하기로 결정했는지(호출 자체는 다음 tool 스텝에서 확인).
    get isToolCall(): boolean {
        return this.role === AI_JOB_STEP_ROLE.assistant && (this.toolCalls?.length ?? 0) > 0;
    }

    get isToolResult(): boolean {
        return this.role === AI_JOB_STEP_ROLE.tool;
    }
}
