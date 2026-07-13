import type {
    EventEvidence,
    ExistingRuleEvidence,
    TurnDigest,
} from "~runtime/domain/rulegen/model/evidence.model.js";

/** 규칙 생성 프롬프트에 실을 근거를 서버에서 읽는다. */
export interface RuleEvidencePort {
    fetchTurns(taskId: string, signal?: AbortSignal): Promise<readonly TurnDigest[]>;
    fetchEvents(taskId: string, signal?: AbortSignal): Promise<readonly EventEvidence[]>;
    fetchExistingRules(signal?: AbortSignal): Promise<readonly ExistingRuleEvidence[]>;
}
