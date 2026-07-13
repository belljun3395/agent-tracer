/** 워크플로와 짧은 활동이 도는 큐다. */
export const AI_JOB_QUEUE = "llm-jobs";

/** 최대 15분인 생성 활동이 짧은 활동의 슬롯을 굶기지 않도록 분리한 큐다. */
export const AI_GENERATE_QUEUE = "llm-jobs-generate";

/** 워커 SDK가 지표를 노출하는 포트다. */
export const TEMPORAL_SDK_METRICS_PORT = 9466;
