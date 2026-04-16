import type React from "react";
import { Navigate, useParams } from "react-router-dom";
import { TaskWorkspace } from "../../features/task-workspace/index.js";

/**
 * Standalone task workspace route at /tasks/:taskId.
 * Renders the workspace without the dashboard sidebar shell.
 */
export function TaskRoute(): React.JSX.Element {
    const { taskId } = useParams<{ readonly taskId: string }>();

    if (!taskId) return <Navigate replace to="/"/>;

    return <TaskWorkspace taskId={taskId} embedded={false} />;
}
