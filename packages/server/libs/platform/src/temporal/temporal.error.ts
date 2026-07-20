import { WorkflowNotFoundError } from "@temporalio/client";

/** 취소할 워크플로가 이미 없다는 뜻이며, 연결 실패와 구분해야 한다. */
export function isWorkflowNotFound(error: unknown): boolean {
    return error instanceof WorkflowNotFoundError;
}
