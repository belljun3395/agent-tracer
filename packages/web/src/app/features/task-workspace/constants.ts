import type { PanelTabId } from "../../components/EventInspector.js";

const DEFAULT_WORKSPACE_TAB: PanelTabId = "overview";
export const WORKSPACE_INSPECTOR_MIN_WIDTH = 340;
export const WORKSPACE_INSPECTOR_MAX_WIDTH = 680;
export const WORKSPACE_INSPECTOR_DEFAULT_WIDTH = 360;
export const WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY = "agent-tracer.workspace-inspector-width";
export const REVIEWER_ID_STORAGE_KEY = "agent-tracer.reviewer-id";

const WORKSPACE_TAB_MAP: Record<string, PanelTabId> = {
    inspector: "inspector",
    overview: "overview",
    turns: "turns",
    evidence: "evidence",
    rules: "rules",
    context: "context",
    actions: "turns",
    save: "turns",
    flow: "overview",
    health: "overview",
    tags: "evidence",
    files: "evidence",
    exploration: "evidence",
    instructions: "context",
    task: "turns",
    compact: "turns",
    evaluate: "turns",
};

export function normalizeWorkspaceTab(value: string | null): PanelTabId {
    if (!value) return DEFAULT_WORKSPACE_TAB;
    return WORKSPACE_TAB_MAP[value] ?? DEFAULT_WORKSPACE_TAB;
}
