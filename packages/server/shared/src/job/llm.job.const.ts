// 비동기 LLM 잡의 큐와 잡 종류 식별자. 잡을 제출하는 쪽과 실행하는 쪽이 공유한다.
export const LLM_JOB_QUEUE = "llm-jobs";
export const RULE_GENERATION_JOB = "ruleGenerationWorkflow";
export const TITLE_SUGGESTION_JOB = "titleSuggestionWorkflow";
