export interface TaskSearchInput {
    readonly query: string;
    readonly taskId?: string;
    readonly limit?: number;
}
