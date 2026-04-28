import type { MonitoringTask } from "~task/domain/task.model.js";
import type { TimelineEvent } from "~event/domain/model/timeline.event.model.js";
import { isInternalEvent, isTaskLifecycleEvent, isUserLane } from "~event/domain/event.predicates.js";
import {
    GENERIC_TASK_TITLE_PREFIXES,
    GENERIC_TASK_TITLE_PREFIX_SPLIT_PATTERN,
    MAX_TASK_TITLE_LENGTH,
    TRAILING_SESSION_SUFFIX_PATTERN,
} from "../common/task.display-title.const.js";

/**
 * Domain model — derives the display title for a task from the task's
 * own metadata and its timeline of events. Encodes which signals to prefer
 * (user goal → task start summary → first meaningful event → fallback).
 */
export class TaskDisplayTitle {
    constructor(
        private readonly task: MonitoringTask | null | undefined,
        private readonly timeline: readonly TimelineEvent[],
    ) {}

    derive(): string | undefined {
        return this.resolvePreferred() ?? undefined;
    }

    private resolvePreferred(): string | null {
        return this.meaningfulTitle()
            ?? this.inferredFromTimeline()
            ?? this.normalizedFallback();
    }

    private meaningfulTitle(): string | null {
        const title = normalizeSentence(this.task?.title);
        if (!title) return null;
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
        const startSummary = this.timeline.find((event) => event.kind === "task.start" && event.body)?.body;
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
        if (segments.length !== 2) return false;
        const [prefix, suffix] = segments;
        if (!prefix || !suffix) return false;
        const normalizedPrefix = normalizeTitleToken(prefix);
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
    return normalized.length > MAX_TASK_TITLE_LENGTH
        ? `${normalized.slice(0, MAX_TASK_TITLE_LENGTH - 3)}...`
        : normalized;
}
