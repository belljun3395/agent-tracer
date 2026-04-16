import { create } from "zustand";

export interface EditState {
    readonly isEditingTaskTitle: boolean;
    readonly taskTitleDraft: string;
    readonly taskTitleError: string | null;
    readonly isSavingTaskTitle: boolean;
    readonly isUpdatingTaskStatus: boolean;
}

interface EditStore extends EditState {
    startEditing: (draft: string) => void;
    updateDraft: (draft: string) => void;
    setTitleError: (error: string | null) => void;
    finishEditing: () => void;
    setSavingTitle: (saving: boolean) => void;
    setUpdatingStatus: (updating: boolean) => void;
    resetEdit: () => void;
}

export const useEditStore = create<EditStore>((set) => ({
    isEditingTaskTitle: false,
    taskTitleDraft: "",
    taskTitleError: null,
    isSavingTaskTitle: false,
    isUpdatingTaskStatus: false,
    startEditing: (draft) => set({ isEditingTaskTitle: true, taskTitleDraft: draft, taskTitleError: null }),
    updateDraft: (taskTitleDraft) => set({ taskTitleDraft }),
    setTitleError: (taskTitleError) => set({ taskTitleError }),
    finishEditing: () => set({ isEditingTaskTitle: false, taskTitleError: null }),
    setSavingTitle: (isSavingTaskTitle) => set({ isSavingTaskTitle }),
    setUpdatingStatus: (isUpdatingTaskStatus) => set({ isUpdatingTaskStatus }),
    resetEdit: () =>
        set({ isEditingTaskTitle: false, taskTitleDraft: "", taskTitleError: null, isSavingTaskTitle: false }),
}));
