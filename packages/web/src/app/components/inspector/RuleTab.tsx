import type React from "react";
import type { TaskId, TimelineEventRecord } from "../../../types.js";

interface RuleTabProps {
    readonly timeline: readonly TimelineEventRecord[];
    readonly taskId?: TaskId | undefined;
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
}

/**
 * Placeholder while the verification rules domain is being introduced
 * (Phase 2). The previous implementation read from rule-commands which has
 * been removed.
 */
export function RuleTab(_props: RuleTabProps): React.JSX.Element {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <p className="m-0 text-[0.9rem] font-medium text-[var(--text-2)]">
                Rules tab is being rebuilt.
            </p>
            <p className="m-0 text-[0.8rem] leading-6 text-[var(--text-3)]">
                Verification rules will replace the previous rule commands in the next step.
            </p>
        </div>
    );
}
