import type React from "react";
import type { FormEvent as ReactFormEvent } from "react";
import type { TimelineEvent } from "@monitor/web-domain";

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
    readonly timeline: readonly TimelineEvent[];
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
    readonly selectedTag: string | null;
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
    readonly onClearTag: () => void;
    readonly onOpenTaskWorkspace?: () => void;
    readonly onChangeTaskStatus?: (status: "running" | "waiting" | "completed" | "errored") => void;
    readonly embedded?: boolean;
    readonly externalControlsState?: {
        readonly isOpen: boolean;
        readonly setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
        readonly popoverPos: { top: number; right: number };
        readonly setPopoverPos: (value: { top: number; right: number }) => void;
        readonly buttonRef: React.RefObject<HTMLButtonElement | null>;
    } | undefined;
    readonly externalFiltersState?: {
        readonly isOpen: boolean;
        readonly setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
        readonly popoverPos: { top: number; right: number };
        readonly setPopoverPos: (value: { top: number; right: number }) => void;
        readonly buttonRef: React.RefObject<HTMLButtonElement | null>;
    } | undefined;
}
