/** 레시피 스캔 잡을 서버 큐에 넣는다. */
export interface RecipeScanJobPort {
    hasActiveScan(taskId: string): Promise<boolean>;
    enqueue(taskId: string, idempotencyKey: string, userPrompt?: string): Promise<boolean>;
}
