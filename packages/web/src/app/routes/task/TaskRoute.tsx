import type React from "react";
import { Navigate, useParams } from "react-router-dom";

/**
 * Deep link `/tasks/:taskId` redirects to the dashboard with the task selected.
 * Timeline is the only view; workspace was merged into it.
 */
export function TaskRoute(): React.JSX.Element {
    const { taskId } = useParams<{ readonly taskId: string }>();
    if (!taskId) return <Navigate replace to="/"/>;
    return <Navigate replace to={`/?task=${encodeURIComponent(taskId)}`}/>;
}
