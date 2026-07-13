import {
    digestEvents,
    digestExistingRules,
    digestTurns,
    TIMELINE_MAX_PAGES,
    TIMELINE_PAGE_LIMIT,
    type EventEvidence,
    type ExistingRuleEvidence,
    type TurnDigest,
} from "~runtime/domain/rulegen/model/evidence.model.js";
import type {RuleEvidencePort} from "~runtime/domain/rulegen/port/rule.evidence.port.js";

const EVIDENCE_TIMEOUT_MS = 10_000;

interface ItemsEnvelope {
    readonly data?: {readonly items?: unknown[]; readonly nextCursor?: string | null};
}

/** 규칙 근거 API의 HTTP 실패 정보다. */
export class RuleEvidenceHttpError extends Error {
    constructor(
        readonly resource: string,
        readonly status: number,
    ) {
        super(`${resource} fetch failed: HTTP ${status}`);
        this.name = "RuleEvidenceHttpError";
    }
}

/** 태스크의 턴과 이벤트와 기존 규칙을 서버에서 읽어 도메인 근거 형태로 준다. */
export class HttpRuleEvidenceAdapter implements RuleEvidencePort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async fetchTurns(taskId: string, signal?: AbortSignal): Promise<readonly TurnDigest[]> {
        const url = `${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/turns`;
        return digestTurns(await this.items(url, "turn context", signal));
    }

    async fetchEvents(taskId: string, signal?: AbortSignal): Promise<readonly EventEvidence[]> {
        const events: EventEvidence[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < TIMELINE_MAX_PAGES; page += 1) {
            const cursorParam = cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`;
            const url = `${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/timeline?limit=${TIMELINE_PAGE_LIMIT}${cursorParam}`;
            const body = await this.envelope(url, "event context", signal);
            events.push(...digestEvents(body.data?.items ?? []));
            const next = body.data?.nextCursor;
            if (next === undefined || next === null || next.length === 0) break;
            cursor = next;
        }
        return events;
    }

    async fetchExistingRules(signal?: AbortSignal): Promise<readonly ExistingRuleEvidence[]> {
        const url = `${this.baseUrl}/api/v1/rules`;
        return digestExistingRules(await this.items(url, "existing rule", signal));
    }

    private async items(url: string, resource: string, signal?: AbortSignal): Promise<unknown[]> {
        const body = await this.envelope(url, resource, signal);
        return body.data?.items ?? [];
    }

    private async envelope(url: string, resource: string, signal?: AbortSignal): Promise<ItemsEnvelope> {
        const response = await fetch(url, {
            headers: this.headers,
            signal: signal ?? AbortSignal.timeout(EVIDENCE_TIMEOUT_MS),
        });
        if (!response.ok) throw new RuleEvidenceHttpError(resource, response.status);
        return await response.json() as ItemsEnvelope;
    }
}
