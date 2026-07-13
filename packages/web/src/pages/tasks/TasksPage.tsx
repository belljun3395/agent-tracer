import { EmptyView } from "~web/shared/ui/index.js";
import { useGuidance } from "~web/shared/store/index.js";

/** `/tasks`: 사이드바만 보이고 선택된 태스크는 없는 상태. */
export default function TasksRoute() {
  const guidance = useGuidance();

  return (
    <EmptyView
      eyebrow="No task selected"
      title="Pick a task from the sidebar"
      description={guidance.messages.app.noTaskSelected}
      locale={guidance.locale}
    />
  );
}
