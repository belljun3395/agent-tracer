import { createStore, type StoreApi } from "zustand";

// ---- Selection store -----------------------------------------------------

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

export interface SelectionActions {
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

export type SelectionStoreState = SelectionState & SelectionActions;

export type SelectionStore = StoreApi<SelectionStoreState>;

export function createSelectionStore(): SelectionStore {
    return createStore<SelectionStoreState>((set) => ({
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
        resetFilters: () =>
            set({ selectedRuleId: null, selectedTag: null, showRuleGapsOnly: false }),
        setConnected: (isConnected) => set({ isConnected }),
        setDeletingTaskId: (deletingTaskId) => set({ deletingTaskId }),
        setDeleteErrorTaskId: (deleteErrorTaskId) => set({ deleteErrorTaskId })
    }));
}

// ---- Edit store ----------------------------------------------------------

export interface EditState {
    readonly isEditingTaskTitle: boolean;
    readonly taskTitleDraft: string;
    readonly taskTitleError: string | null;
    readonly isSavingTaskTitle: boolean;
    readonly isUpdatingTaskStatus: boolean;
}

export interface EditActions {
    startEditing: (draft: string) => void;
    updateDraft: (draft: string) => void;
    setTitleError: (error: string | null) => void;
    finishEditing: () => void;
    setSavingTitle: (saving: boolean) => void;
    setUpdatingStatus: (updating: boolean) => void;
}

export type EditStoreState = EditState & EditActions;

export type EditStore = StoreApi<EditStoreState>;

export function createEditStore(): EditStore {
    return createStore<EditStoreState>((set) => ({
        isEditingTaskTitle: false,
        taskTitleDraft: "",
        taskTitleError: null,
        isSavingTaskTitle: false,
        isUpdatingTaskStatus: false,
        startEditing: (draft) =>
            set({ isEditingTaskTitle: true, taskTitleDraft: draft, taskTitleError: null }),
        updateDraft: (taskTitleDraft) => set({ taskTitleDraft }),
        setTitleError: (taskTitleError) => set({ taskTitleError }),
        finishEditing: () => set({ isEditingTaskTitle: false, taskTitleError: null }),
        setSavingTitle: (isSavingTaskTitle) => set({ isSavingTaskTitle }),
        setUpdatingStatus: (isUpdatingTaskStatus) => set({ isUpdatingTaskStatus })
    }));
}

// ---- Bundle --------------------------------------------------------------

export interface UiStoreBundle {
    readonly selection: SelectionStore;
    readonly edit: EditStore;
}

export function createUiStore(): UiStoreBundle {
    return {
        selection: createSelectionStore(),
        edit: createEditStore()
    };
}
