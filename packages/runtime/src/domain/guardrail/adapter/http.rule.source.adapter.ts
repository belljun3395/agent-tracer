import {RULE_REVIEW_STATE} from "@monitor/kernel/rule/definition/rule.review.js";
import type {RuleExpectation} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {getJson} from "~runtime/config/http.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {RuleSourcePort} from "~runtime/domain/guardrail/port/rule.source.port.js";
import {isRecord} from "~runtime/support/json.js";

const RULES_ENDPOINT = "/api/v1/rules?scope=all";
const FETCH_TIMEOUT_MS = 3000;

interface RulesEnvelope {
    readonly data?: {readonly items?: unknown[]};
}

/** 서버의 규칙 목록을 읽어 집행에 필요한 속성만 남긴다. */
export class HttpRuleSourceAdapter implements RuleSourcePort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async fetchAll(): Promise<readonly GuardrailRule[]> {
        const body = await getJson<RulesEnvelope>(
            `${this.baseUrl}${RULES_ENDPOINT}`,
            this.headers,
            FETCH_TIMEOUT_MS,
        );
        const items = Array.isArray(body?.data?.items) ? body.data.items : [];
        return items.map(parseRule).filter((rule): rule is GuardrailRule => rule !== null);
    }
}

function parseRule(item: unknown): GuardrailRule | null {
    if (!isRecord(item)) return null;
    const expectation = item["expectation"];
    const taskId = item["taskId"];
    const anchorEventId = item["anchorEventId"];
    if (typeof item["name"] !== "string" || !isRecord(expectation)) return null;
    // 서버가 주는 규칙에는 태스크와 근거 입력이 반드시 있다.
    if (typeof taskId !== "string" || typeof anchorEventId !== "string") return null;
    return {
        name: item["name"],
        severity: typeof item["severity"] === "string" ? item["severity"] : "info",
        taskId,
        anchorEventId,
        reviewState: typeof item["reviewState"] === "string" ? item["reviewState"] : RULE_REVIEW_STATE.pendingReview,
        expectation: expectation as unknown as RuleExpectation,
    };
}
