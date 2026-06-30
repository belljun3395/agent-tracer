import { Inject, Injectable } from "@nestjs/common";
import {
    TITLE_SUGGESTION_DISPATCHER,
    type ITitleSuggestionDispatcher,
} from "../../public/task/title.suggestion.dispatcher.port.js";
import type {
    SuggestTaskTitleUseCaseIn,
    SuggestTaskTitleUseCaseOut,
} from "./dto/suggest.task.title.usecase.dto.js";

// 제목 제안 실행은 워커가 소유한다. 유스케이스는 Temporal로 전달만 한다.
@Injectable()
export class SuggestTaskTitleUseCase {
    constructor(
        @Inject(TITLE_SUGGESTION_DISPATCHER)
        private readonly dispatcher: ITitleSuggestionDispatcher,
    ) {}

    async execute(
        input: SuggestTaskTitleUseCaseIn,
    ): Promise<SuggestTaskTitleUseCaseOut> {
        return this.dispatcher.dispatch(input.taskId);
    }
}
