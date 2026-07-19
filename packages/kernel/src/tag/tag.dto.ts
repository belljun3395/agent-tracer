export interface TagDto {
    readonly id: string;
    readonly userId: string;
    readonly name: string;
    /** `#rrggbb` 소문자 여섯 자리다. */
    readonly color: string;
    readonly description: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/** 태그 목록 화면은 그 태그가 몇 개의 태스크에 붙어 있는지를 함께 읽는다. */
export interface TagSummaryDto extends TagDto {
    readonly taskCount: number;
}

export interface CreateTagInput {
    readonly name: string;
    readonly color?: string;
    readonly description?: string | null;
}

export interface UpdateTagInput {
    readonly name?: string;
    readonly color?: string;
    readonly description?: string | null;
}

/** 목록에 없는 태그가 떨어지는 치환 의미론이다. */
export interface SetTaskTagsInput {
    readonly taskId: string;
    readonly tagIds: readonly string[];
}

export interface TaskTagsDto {
    readonly taskId: string;
    readonly tags: readonly TagDto[];
}
