import { useParams } from "react-router-dom";
import { TaskId } from "~web/shared/identity.js";
import { FeedPanel } from "~web/widgets/feed/index.js";
import { EmptyView } from "~web/shared/ui/index.js";

/** `/tasks/:taskId`: 주 Operator 뷰. */
export default function TaskRoute() {
  const { taskId } = useParams<{ taskId: string }>();
  if (!taskId) {
    return <EmptyView eyebrow="404" title="Missing task id" />;
  }
  return <FeedPanel taskId={TaskId(taskId)} />;
}
