import type { SuggestTaskTitleUseCaseOut } from "../dto/suggest.task.title.usecase.dto.js";

export const TITLE_SUGGESTION_DISPATCHER = "TITLE_SUGGESTION_DISPATCHER";

// 제목 제안 실행을 워커로 넘기고 결과를 동기로 돌려받는다. 어댑터가 Temporal 워크플로를 실행한다.
export interface ITitleSuggestionDispatcher {
    dispatch(taskId: string): Promise<SuggestTaskTitleUseCaseOut>;
}
