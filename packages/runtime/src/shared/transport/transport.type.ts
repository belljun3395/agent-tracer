export interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
    readonly taskCreated?: boolean;
    readonly sessionCreated?: boolean;
}
