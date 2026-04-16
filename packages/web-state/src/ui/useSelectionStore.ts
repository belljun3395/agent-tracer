import { create } from "zustand";

export interface SelectionState {
    readonly selectedTaskId: string | null;
    readonly selectedEventId: string | null;
    readonly selectedConnectorKey: string | null;
    readonly selectedRuleId: string | null;
    readonly selectedTag: string | null;
    readonly showRuleGapsOnly: boolean;
    readonly isConnected: boolean;
    readonly deletingTaskId: string | null;
    readonly deleteErrorTaskId: string | null;
}

interface SelectionStore extends SelectionState {
    selectTask: (taskId: string | null) => void;
    selectEvent: (eventId: string | null) => void;
    selectConnector: (key: string | null) => void;
    selectRule: (ruleId: string | null) => void;
    selectTag: (tag: string | null) => void;
    setShowRuleGapsOnly: (show: boolean) => void;
    resetFilters: () => void;
    setConnected: (connected: boolean) => void;
    setDeletingTaskId: (taskId: string | null) => void;
    setDeleteErrorTaskId: (taskId: string | null) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedTaskId: null,
    selectedEventId: null,
    selectedConnectorKey: null,
    selectedRuleId: null,
    selectedTag: null,
    showRuleGapsOnly: false,
    isConnected: false,
    deletingTaskId: null,
    deleteErrorTaskId: null,
    selectTask: (selectedTaskId) => set({ selectedTaskId }),
    selectEvent: (selectedEventId) => set({ selectedEventId }),
    selectConnector: (selectedConnectorKey) => set({ selectedConnectorKey }),
    selectRule: (selectedRuleId) => set({ selectedRuleId }),
    selectTag: (selectedTag) => set({ selectedTag }),
    setShowRuleGapsOnly: (showRuleGapsOnly) => set({ showRuleGapsOnly }),
    resetFilters: () => set({ selectedRuleId: null, selectedTag: null, showRuleGapsOnly: false }),
    setConnected: (isConnected) => set({ isConnected }),
    setDeletingTaskId: (deletingTaskId) => set({ deletingTaskId }),
    setDeleteErrorTaskId: (deleteErrorTaskId) => set({ deleteErrorTaskId }),
}));
