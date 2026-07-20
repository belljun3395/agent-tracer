/** 에이전트가 다시 지은 태스크 제목을 커맨드 API로 보내는 포트다. */
export interface TaskRenamePort {
    rename(taskId: string, title: string): Promise<boolean>;
}
