import { useParams } from "react-router-dom";
import { TaskId } from "~domain/monitoring.js";
import { FeedPanel } from "~features/feed/index.js";
import { EmptyView } from "~features/shell/index.js";

/**
 * `/tasks/:taskId` — primary Operator view. Hands off to FeedPanel which
 * owns its own data fetching and loading/error states.
 */
export default function TaskRoute() {
  const { taskId } = useParams<{ taskId: string }>();
  if (!taskId) {
    return <EmptyView eyebrow="404" title="Missing task id" />;
  }
  return <FeedPanel taskId={TaskId(taskId)} />;
}
