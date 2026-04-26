import type React from "react";
import type { FormEvent as ReactFormEvent } from "react";
import type { TimelineEventRecord, TimelineLane } from "~domain/monitoring.js";
import type { TurnPartition } from "~domain/turn-partition.js";

export interface TimelineObservabilityStats {
    readonly actions: number;
    readonly coordinationActivities: number;
    readonly exploredFiles: number;
    readonly compactions: number;
    readonly checks: number;
    readonly violations: number;
    readonly passes: number;
}

export interface TimelineProps {
    readonly timeline: readonly TimelineEventRecord[];
    readonly taskTitle: string | null;
    readonly taskId?: string | null;
    readonly taskWorkspacePath?: string | undefined;
    readonly taskStatus?: "running" | "waiting" | "completed" | "errored" | undefined;
    readonly taskUpdatedAt?: string | undefined;
    readonly taskUsesDerivedTitle: boolean;
    readonly isEditingTaskTitle: boolean;
    readonly taskTitleDraft: string;
    readonly taskTitleError: string | null;
    readonly isSavingTaskTitle: boolean;
    readonly isUpdatingTaskStatus?: boolean;
    readonly selectedEventId: string | null;
    readonly selectedConnectorKey: string | null;
    readonly selectedRuleId: string | null;
    readonly showRuleGapsOnly: boolean;
    readonly nowMs: number;
    readonly zoom: number;
    readonly onZoomChange: (zoom: number) => void;
    readonly observabilityStats: TimelineObservabilityStats;
    readonly onSelectEvent: (eventId: string) => void;
    readonly onSelectConnector: (key: string) => void;
    readonly onStartEditTitle: () => void;
    readonly onCancelEditTitle: () => void;
    readonly onSubmitTitle: (event: ReactFormEvent<HTMLFormElement>) => void;
    readonly onTitleDraftChange: (value: string) => void;
    readonly onClearFilters: () => void;
    readonly onToggleRuleGap: (show: boolean) => void;
    readonly onClearRuleId: () => void;
    readonly onChangeTaskStatus?: (status: "running" | "waiting" | "completed" | "errored") => void;
    readonly embedded?: boolean;
    readonly externalFiltersState?: {
        readonly isOpen: boolean;
        readonly setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
        readonly popoverPos: { top: number; right: number };
        readonly setPopoverPos: (value: { top: number; right: number }) => void;
        readonly buttonRef: React.RefObject<HTMLButtonElement | null>;
    } | undefined;
    readonly externalTimelineFilters?: {
        readonly filters: Record<TimelineLane, boolean>;
        readonly setFilters: React.Dispatch<React.SetStateAction<Record<TimelineLane, boolean>>>;
    } | undefined;
    readonly turnPartition?: TurnPartition | null;
    readonly focusedTurnGroupId?: string | null;
    readonly onSelectTurnGroup?: ((groupId: string | null) => void) | undefined;
}
