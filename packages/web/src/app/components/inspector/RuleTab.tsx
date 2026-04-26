import type React from "react";
import type { TaskId, TimelineEventRecord } from "../../../types.js";
import { RulesContent } from "../rules/RulesContent.js";

interface RuleTabProps {
    readonly timeline: readonly TimelineEventRecord[];
    readonly taskId?: TaskId | undefined;
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
}

/**
 * Inspector "Rules" tab — task-scoped management surface. Falls back to a
 * global view when no task is selected.
 */
export function RuleTab({ taskId }: RuleTabProps): React.JSX.Element {
    return (
        <RulesContent
            defaultScope={taskId ? "task" : "global"}
            {...(taskId ? { defaultTaskId: taskId } : {})}
            lockScope={taskId !== undefined}
        />
    );
}
