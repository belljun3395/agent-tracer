import { useSelectionStore, useEditStore } from "../../../state.js";
import { useWorkspaceData } from "./useWorkspaceData.js";
import { useWorkspaceMutations } from "./useWorkspaceMutations.js";

export function useWorkspace(taskId: string) {
    const selectEvent = useSelectionStore((s) => s.selectEvent);
    const selectConnector = useSelectionStore((s) => s.selectConnector);
    const selectRule = useSelectionStore((s) => s.selectRule);
    const selectTag = useSelectionStore((s) => s.selectTag);
    const setShowRuleGapsOnly = useSelectionStore((s) => s.setShowRuleGapsOnly);
    const resetFilters = useSelectionStore((s) => s.resetFilters);

    const isEditingTaskTitle = useEditStore((s) => s.isEditingTaskTitle);
    const taskTitleDraft = useEditStore((s) => s.taskTitleDraft);
    const taskTitleError = useEditStore((s) => s.taskTitleError);
    const isSavingTaskTitle = useEditStore((s) => s.isSavingTaskTitle);
    const isUpdatingTaskStatus = useEditStore((s) => s.isUpdatingTaskStatus);
    const startEditing = useEditStore((s) => s.startEditing);
    const updateDraft = useEditStore((s) => s.updateDraft);
    const setTitleError = useEditStore((s) => s.setTitleError);
    const finishEditing = useEditStore((s) => s.finishEditing);

    const data = useWorkspaceData(taskId);
    const mutations = useWorkspaceMutations(taskId, data);

    return {
        // Selection actions (state comes from ...data)
        selectEvent, selectConnector, selectRule, selectTag, setShowRuleGapsOnly, resetFilters,
        // Edit state
        isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus,
        startEditing, updateDraft, setTitleError, finishEditing,
        // Data (includes selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly)
        ...data,
        // Mutations
        ...mutations,
    };
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;
