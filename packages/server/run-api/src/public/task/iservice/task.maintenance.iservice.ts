/** task 유지보수(보관/제목변경/부모연결/slug재발급) 발행 계약. TASK_MAINTENANCE 토큰으로 주입한다. */
export interface ITaskMaintenance {
    /** 태스크를 보관 처리한다(미존재/이미보관 시 에러). */
    archive(taskId: string): Promise<void>;
    /** 제목을 변경한다. 태스크가 없으면 false. */
    rename(taskId: string, title: string): Promise<boolean>;
    /** 부모 태스크를 연결한다. */
    link(taskId: string, parentTaskId: string): Promise<void>;
    /** 공개 slug를 재발급한다. */
    reslug(
        taskId: string,
        slug: string,
    ): Promise<{ readonly status: "reslugged" | "not_found" }>;
}
