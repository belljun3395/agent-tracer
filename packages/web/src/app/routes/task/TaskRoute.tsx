import type React from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

/**
 * Standalone task workspace route at /tasks/:taskId.
 * Redirects into the in-app workspace view so the dashboard shell stays shared.
 */
export function TaskRoute(): React.JSX.Element {
    const { taskId } = useParams<{ readonly taskId: string }>();
    const [searchParams] = useSearchParams();

    if (!taskId) return <Navigate replace to="/"/>;
    const next = new URLSearchParams();
    next.set("task", taskId);
    next.set("view", "workspace");
    const tab = searchParams.get("tab");
    if (tab) next.set("tab", tab);

    return <Navigate replace to={`/?${next.toString()}`}/>;
}
