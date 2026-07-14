import type {
    EventEvidence,
    ExistingRuleEvidence,
    TurnDigest,
} from "~runtime/domain/rulegen/model/evidence.model.js";

/** 규칙 근거 조회가 서버 응답으로 실패한 것이다. */
export class RuleEvidenceHttpError extends Error {
    constructor(
        readonly resource: string,
        readonly status: number,
    ) {
        super(`${resource} fetch failed: HTTP ${status}`);
        this.name = "RuleEvidenceHttpError";
    }
}

/** 규칙 생성 도구가 실행 중에 더 가져오는 근거를 서버에서 읽는다. */
export interface RuleEvidencePort {
    fetchTurns(taskId: string, signal?: AbortSignal): Promise<readonly TurnDigest[]>;
    fetchEvents(taskId: string, limit: number, signal?: AbortSignal): Promise<readonly EventEvidence[]>;
    fetchExistingRules(signal?: AbortSignal): Promise<readonly ExistingRuleEvidence[]>;
}
