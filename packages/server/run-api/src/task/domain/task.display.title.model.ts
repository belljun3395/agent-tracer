import type { MonitoringTask } from "@monitor/run-api/task/domain/task.model.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";
import { isInternalEvent, isTaskLifecycleEvent, isUserLane } from "@monitor/timeline-api/event/public/predicates.js";
import { KIND } from "@monitor/timeline-api/event/public/types/event.const.js";
import {
    GENERIC_TASK_TITLE_PREFIXES,
    GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN,
    MAX_TASK_TITLE_LENGTH,
    TRAILING_SESSION_SUFFIX_PATTERN,
} from "../common/task.display.title.const.js";

export class TaskDisplayTitle {
    constructor(
        private readonly task: MonitoringTask | null | undefined,
        private readonly timeline: readonly TimelineEvent[],
    ) {}

    derive(): string | undefined {
        return this.resolvePreferred() ?? undefined;
    }

    needsTimeline(): boolean {
        return this.meaningfulTitle() === null;
    }

    private resolvePreferred(): string | null {
        return this.meaningfulTitle()
            ?? this.inferredFromTimeline()
            ?? this.normalizedFallback();
    }

    private meaningfulTitle(): string | null {
        const title = normalizeSentence(this.task?.title);
        if (!title) return null;
        // 워크스페이스명 기반의 일반 제목은 사용자 의도가 아니므로 타임라인에서 다시 추론한다.
        return this.isGenericWorkspaceTitle(title) ? null : title;
    }

    private inferredFromTimeline(): string | null {
        for (const candidate of this.titleCandidates()) {
            const title = meaningfulInferredTitle(candidate);
            if (title) return title;
        }
        return null;
    }

    private titleCandidates(): readonly (string | undefined)[] {
        const userGoal = this.timeline.find((event) => isUserLane(event.lane)
            && !isTaskLifecycleEvent(event)
            && event.body)?.body;
        const startSummary = this.timeline.find((event) => event.kind === KIND.taskStart && event.body)?.body;
        const firstMeaningful = this.timeline.find((event) => !isInternalEvent(event));
        return [userGoal, startSummary, firstMeaningful?.body, firstMeaningful?.title];
    }

    private normalizedFallback(): string | null {
        const normalized = normalizeSentence(this.task?.title);
        if (!normalized) return null;
        return stripTrailingSessionSuffix(normalized);
    }

    private isGenericWorkspaceTitle(normalizedTitle: string): boolean {
        if (!this.task) return false;
        const segments = normalizedTitle.split(GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN);
        // "prefix - suffix" 형태가 아니면 일반 워크스페이스 제목으로 보지 않는다.
        if (segments.length !== 2) return false;
        const [prefix, suffix] = segments;
        if (!prefix || !suffix) return false;
        const normalizedPrefix = normalizeTitleToken(prefix);
        // 알려진 세션 시작 prefix일 때만 suffix를 워크스페이스/slug와 비교한다.
        if (!GENERIC_TASK_TITLE_PREFIXES.has(normalizedPrefix)) return false;
        const workspaceName = this.task.workspacePath
            ?.split("/")
            .filter(Boolean)
            .pop();
        const normalizedSuffix = normalizeTitleToken(stripTrailingSessionSuffix(suffix));
        return normalizedSuffix === normalizeTitleToken(this.task.slug)
            || (workspaceName ? normalizedSuffix === normalizeTitleToken(workspaceName) : false);
    }
}

function meaningfulInferredTitle(value?: string): string | null {
    const normalized = normalizeSentence(value);
    // 세션 시작 상용구는 사용자 의도 제목으로 쓰지 않는다.
    if (!normalized || isAgentSessionBoilerplate(normalized)) return null;
    return normalized;
}

function stripTrailingSessionSuffix(value: string): string {
    return value.replace(TRAILING_SESSION_SUFFIX_PATTERN, "").trim();
}

function normalizeTitleToken(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isAgentSessionBoilerplate(value: string): boolean {
    const normalized = normalizeTitleToken(value);
    return /^(claude code|claude|codex app-server|codex app server|codex cli|codex|agent|ai cli) session started\b/.test(normalized)
        || /^(claude code|claude|codex app-server|codex app server|codex cli|codex|agent|ai cli) - /.test(normalized);
}

function normalizeSentence(value?: string): string | null {
    if (!value) return null;
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    // UI 제목은 길이 상한을 넘으면 말줄임표로 고정한다.
    return normalized.length > MAX_TASK_TITLE_LENGTH
        ? `${normalized.slice(0, MAX_TASK_TITLE_LENGTH - 3)}...`
        : normalized;
}
