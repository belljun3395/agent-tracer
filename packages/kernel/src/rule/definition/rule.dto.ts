import type { RuleReviewState } from "./rule.review.js";
import type { RuleExpectation } from "./rule.vocabulary.js";
import type { VerdictStatus } from "../evaluation/rule.verdict.js";

// 저장·판정과 동일한 타입을 와이어에도 써서 표현 불가능한 조합을 허용하지 않는다.
export type RuleExpectationDto = RuleExpectation;

export interface RuleDto {
    /** 승인 대기 규칙은 판정에 쓰이지 않으며 web이 승인 상태를 표현한다. */
    readonly reviewState: RuleReviewState;
    readonly id: string;
    readonly userId: string;
    readonly name: string;
    readonly expectation: RuleExpectationDto;
    readonly taskId: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly signature: string;
    readonly userEdited: boolean;
    readonly lastEditedBy: string;
    readonly rev: number;
    /** 규칙을 생성한 잡 식별자다. */
    readonly sourceJobId: string | null;
    /** 규칙 판정 창의 시작점인 사용자 입력 이벤트 식별자다. */
    readonly anchorEventId: string;
    readonly createdAt: string;
    /** 이 규칙에 대응한 이벤트 수다. */
    readonly matchCount?: number;
    /** 아직 판정이 열리지 않았으면 null이다. */
    readonly verdictStatus: VerdictStatus | null;
    /** 에이전트에게 미이행을 알린 횟수다. */
    readonly nudgeCount: number;
    /** 상한만큼 알렸는데도 이행되지 않아 사람에게 넘어온 판정이다. */
    readonly escalated: boolean;
}
