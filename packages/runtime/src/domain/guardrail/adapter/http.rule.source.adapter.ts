import {RULE_REVIEW_STATE} from "@monitor/kernel/rule/definition/rule.review.js";
import {
    RULE_SCOPE,
    type RuleExpectation,
    type RuleTrigger,
} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
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
    const trigger = item["trigger"];
    const expectation = item["expectation"];
    if (typeof item["name"] !== "string" || !isRecord(trigger) || !isRecord(expectation)) return null;
    if (!Array.isArray(trigger["phrases"])) return null;
    return {
        name: item["name"],
        severity: typeof item["severity"] === "string" ? item["severity"] : "info",
        scope: typeof item["scope"] === "string" ? item["scope"] : RULE_SCOPE.global,
        taskId: typeof item["taskId"] === "string" ? item["taskId"] : null,
        reviewState: typeof item["reviewState"] === "string" ? item["reviewState"] : RULE_REVIEW_STATE.pendingReview,
        anchorEventId: typeof item["anchorEventId"] === "string" ? item["anchorEventId"] : null,
        trigger: trigger as unknown as RuleTrigger,
        expectation: expectation as unknown as RuleExpectation,
    };
}
