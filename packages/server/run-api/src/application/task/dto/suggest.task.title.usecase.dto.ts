export interface SuggestTaskTitleUseCaseIn {
    readonly taskId: string;
}

export type {
    SuggestTaskTitleProposalDto,
    SuggestTaskTitleUseCaseOut,
} from "../../../public/task/title.suggestion.dto.js";
