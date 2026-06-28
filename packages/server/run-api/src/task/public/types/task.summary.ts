// task가 외부에 발행하는 요약 뷰 타입(published language). 소비자(insight·rules)는
// task/application 내부 dto가 아니라 이 타입에 의존한다.

export interface TaskSummaryToolCount {
    readonly tool: string;
    readonly count: number;
}

export interface TaskSummaryFile {
    readonly path: string;
    readonly touches: number;
}

export interface TaskSummaryCommand {
    readonly command: string;
    readonly count: number;
}

export interface TaskSummary {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly workspacePath?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly firstUserMessage?: {
        readonly title: string;
        readonly body?: string;
    };
    readonly eventCount: number;
    readonly toolCounts: readonly TaskSummaryToolCount[];
    readonly topFiles: readonly TaskSummaryFile[];
    readonly topCommands: readonly TaskSummaryCommand[];
}
