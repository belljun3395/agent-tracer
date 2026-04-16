/** Korean UI strings used across web-domain. */

// Handoff prompt preambles (per purpose)
export const KO_HANDOFF_PREAMBLE_CONTINUE =
    "이전에 진행하던 작업을 이어받습니다. 아래 briefing을 읽고 작업을 재개하세요.";
export const KO_HANDOFF_PREAMBLE_HANDOFF =
    "다른 개발자가 진행하던 작업을 인수받습니다. 아래 briefing을 읽고 현재 상태를 파악하세요.";
export const KO_HANDOFF_PREAMBLE_REVIEW =
    "완료된 작업을 리뷰합니다. 아래 briefing을 읽고 목표 대비 완성도를 평가하세요.";
export const KO_HANDOFF_PREAMBLE_REFERENCE =
    "과거 작업의 참조 워크플로우입니다. 유사한 작업 시 참고용으로 활용하세요.";

// Handoff prompt actions (per purpose)
export const KO_HANDOFF_ACTION_CONTINUE =
    "가장 긴급한 미완료 항목부터 작업을 시작하세요.";
export const KO_HANDOFF_ACTION_HANDOFF =
    "인수 사항을 확인하고, 첫 번째 행동을 결정하세요.";
export const KO_HANDOFF_ACTION_REVIEW =
    "작업을 plan 대비 검토하고, 품질 이슈나 개선점을 정리하세요.";
export const KO_HANDOFF_ACTION_REFERENCE =
    "monitor_find_similar_workflows MCP 도구로 유사 워크플로우를 검색하여 비교하세요.";

// Evaluate prompt strings
export const KO_EVALUATE_INTRO =
    "완료된 작업을 평가하고 monitor_evaluate_task MCP 도구를 호출하여 워크플로우 라이브러리에 저장하세요.";
export const KO_EVALUATE_INSTRUCTIONS_HEADER =
    "\n아래 context를 바탕으로 monitor_evaluate_task MCP 도구를 호출하세요:\n";
export const KO_EVALUATE_FIELD_RATING =
    "- rating: 접근법이 효과적이었으면 \"good\", 아니면 \"skip\"";
export const KO_EVALUATE_FIELD_USE_CASE =
    "- useCase: 이 작업의 유형 (예: \"TypeScript 타입 에러 수정\")";
export const KO_EVALUATE_FIELD_OUTCOME_NOTE =
    "- outcomeNote: 달성한 결과 요약";
export const KO_EVALUATE_FIELD_APPROACH_NOTE =
    "- approachNote: 효과적이었던 접근법과 이유";
export const KO_EVALUATE_FIELD_REUSE_WHEN =
    "- reuseWhen: 이 워크플로우를 재사용할 상황";
export const KO_EVALUATE_FIELD_WATCHOUTS =
    "- watchouts: 유사 작업 시 주의사항";
export const KO_EVALUATE_FIELD_WORKFLOW_TAGS =
    "- workflowTags: 분류 태그 (예: [\"typescript\", \"refactor\"])";
export const KO_EVALUATE_CALL_NOW =
    "\n확인을 구하지 말고 바로 도구를 호출하세요.";

// Timeline UI strings
export const KO_TIMELINE_STACKED_EVENTS = (count: number): string =>
    `${count}개 이벤트 겹침`;
