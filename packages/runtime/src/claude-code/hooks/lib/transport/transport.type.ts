/**
 * Shape of the JSON body returned by POST /api/runtime-session-ensure.
 * Indicates whether a new task or session was created during this call.
 */
export interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
    readonly taskCreated?: boolean;
    readonly sessionCreated?: boolean;
}
