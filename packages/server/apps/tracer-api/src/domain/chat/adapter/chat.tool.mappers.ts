import { isSensitiveSettingKey } from "@monitor/tracer-domain";
import type {
    AiJobEntity,
    AppSettingEntity,
    EventEntity,
    MemoEntity,
    RecipeApplicationEntity,
    RecipeEntity,
    RuleEntity,
    SessionEntity,
    TagEntity,
    TaskCleanupSuggestionEntity,
    VerdictEntity,
} from "@monitor/tracer-domain";

const MASK_DOT_COUNT = 8;

function iso(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
}

export function mapEvent(event: EventEntity): Record<string, unknown> {
    return {
        id: event.id,
        seq: event.seq,
        taskId: event.taskId,
        kind: event.kind,
        lane: event.lane,
        title: event.title,
        body: event.body,
        toolName: event.toolName,
        filePaths: event.filePaths,
        occurredAt: event.occurredAt.toISOString(),
    };
}

export function mapMemo(memo: MemoEntity): Record<string, unknown> {
    return {
        id: memo.id,
        taskId: memo.taskId,
        eventId: memo.eventId,
        body: memo.body,
        author: memo.author,
        createdAt: memo.createdAt.toISOString(),
        updatedAt: memo.updatedAt.toISOString(),
    };
}

export function mapRule(rule: RuleEntity, verdict: VerdictEntity | undefined): Record<string, unknown> {
    return {
        id: rule.id,
        name: rule.name,
        expectation: rule.expectation,
        taskId: rule.taskId,
        source: rule.source,
        severity: rule.severity,
        rationale: rule.rationale,
        reviewState: rule.reviewState,
        anchorEventId: rule.anchorEventId,
        createdAt: rule.createdAt.toISOString(),
        verdictStatus: verdict?.status ?? null,
    };
}

export function mapTag(tag: TagEntity, taskCount: number): Record<string, unknown> {
    return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        taskCount,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
    };
}

export function mapRecipe(recipe: RecipeEntity, applications: readonly RecipeApplicationEntity[]): Record<string, unknown> {
    const outcomes: Record<string, number> = {};
    for (const application of applications) {
        const key = application.outcome ?? "unknown";
        outcomes[key] = (outcomes[key] ?? 0) + 1;
    }
    return {
        id: recipe.id,
        status: recipe.status,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        pitfalls: recipe.pitfalls,
        steps: recipe.steps,
        touchedFiles: recipe.touchedFiles,
        language: recipe.language,
        createdAt: recipe.createdAt.toISOString(),
        updatedAt: recipe.updatedAt.toISOString(),
        stats: { applications: applications.length, outcomes },
    };
}

export function mapCleanup(suggestion: TaskCleanupSuggestionEntity): Record<string, unknown> {
    return {
        id: suggestion.id,
        jobId: suggestion.jobId,
        taskId: suggestion.taskId,
        kind: suggestion.kind,
        currentValue: suggestion.currentValue,
        proposedValue: suggestion.proposedValue,
        rationale: suggestion.rationale,
        status: suggestion.status,
        createdAt: suggestion.createdAt.toISOString(),
        resolvedAt: iso(suggestion.resolvedAt),
    };
}

export function mapJob(job: AiJobEntity): Record<string, unknown> {
    return {
        id: job.id,
        kind: job.kind,
        executor: job.executor,
        status: job.status,
        attempts: job.attempts,
        taskId: job.taskId,
        input: job.input,
        result: job.result,
        usage: job.usage,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        startedAt: iso(job.startedAt),
        completedAt: iso(job.completedAt),
    };
}

export function mapSession(session: SessionEntity): Record<string, unknown> {
    return {
        id: session.id,
        taskId: session.taskId,
        runtimeSource: session.runtimeSource,
        runtimeSessionId: session.runtimeSessionId,
        status: session.status,
        summary: session.summary,
        startedAt: iso(session.startedAt),
        endedAt: iso(session.endedAt),
    };
}

export function mapSetting(setting: AppSettingEntity): Record<string, unknown> {
    return {
        key: setting.key,
        maskedValue: maskSettingValue(setting.key, setting.value),
        hasValue: true,
        updatedAt: setting.updatedAt.toISOString(),
    };
}

/** 저장소가 복호화된 값을 주므로 모델에게 내보내기 전에 민감 키를 가린다. */
function maskSettingValue(key: string, value: string): string {
    if (!isSensitiveSettingKey(key)) return value;
    if (value.length <= 4) return "•".repeat(value.length);
    return "•".repeat(MASK_DOT_COUNT) + value.slice(-4);
}
