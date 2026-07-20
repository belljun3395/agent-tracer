import type {
    EventEntity,
    EventRepository,
    RecipeApplicationRepository,
    RecipeRepository,
    RuleEvaluationPorts,
    RuleRepository,
    SessionRepository,
    TaskRepository,
    TurnRepository,
} from "@monitor/tracer-domain";

/** 실행 태스크와 세션 읽기 모델을 투영하는 저장소 경계다. */
export interface RunProjectionRepositories {
    readonly tasks: TaskRepository;
    readonly sessions: SessionRepository;
}

/** 레시피 적용과 성과를 투영하는 저장소 경계다. */
export interface RecipeProjectionRepositories {
    readonly recipes: RecipeRepository;
    readonly recipeApplications: RecipeApplicationRepository;
    readonly events: Pick<EventRepository, "findByTaskSinceSeq">;
}

/** 실행 이벤트 라우팅에 필요한 실행·레시피 저장소 경계다. */
export type RunEventProjectionRepositories = RunProjectionRepositories & RecipeProjectionRepositories;

/** 타임라인 이벤트와 턴 조립을 투영하는 저장소 경계다. */
export interface TimelineProjectionRepositories {
    readonly events: EventRepository;
    readonly turns: TurnRepository;
    findEventById(id: string): Promise<EventEntity | null>;
    findRunningAsyncAction(taskId: string, asyncTaskId: string): Promise<EventEntity | null>;
}

/** 규칙 판정과 판정 요약을 투영하는 저장소 경계다. */
export interface RuleProjectionRepositories extends RuleEvaluationPorts {
    readonly rules: RuleRepository;
}

/** 한 원장 배치를 투영하는 이 슬라이스 전체 저장소의 합집합이다. */
export type LedgerProjectionRepositories = RunEventProjectionRepositories &
    TimelineProjectionRepositories &
    RuleProjectionRepositories;
