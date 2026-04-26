import type { TimelineLane } from "../../../types.js";
export interface LaneTheme {
    readonly label: string;
    readonly description: string;
    readonly icon: string;
    readonly toneVar: string;
    readonly bgVar: string;
    readonly borderVar: string;
}
export const LANE_THEME: Partial<Record<TimelineLane, LaneTheme>> & Record<"background", LaneTheme> = {
    user: {
        label: "User",
        description: "User instructions & task boundaries",
        icon: "/icons/message.svg",
        toneVar: "--user",
        bgVar: "--user-bg",
        borderVar: "--user-border"
    },
    planning: {
        label: "Planning",
        description: "Analysis, approach decisions, context checkpoints",
        icon: "/icons/layers.svg",
        toneVar: "--planning",
        bgVar: "--planning-bg",
        borderVar: "--planning-border"
    },
    coordination: {
        label: "Coordination",
        description: "MCP calls, skill usage, delegation, handoff, and search activity",
        icon: "/icons/activity.svg",
        toneVar: "--coordination",
        bgVar: "--coordination-bg",
        borderVar: "--coordination-border"
    },
    exploration: {
        label: "Exploration",
        description: "File reads, searches, dependency checks",
        icon: "/icons/file.svg",
        toneVar: "--exploration",
        bgVar: "--exploration-bg",
        borderVar: "--exploration-border"
    },
    implementation: {
        label: "Implementation",
        description: "Code edits, writes, file changes",
        icon: "/icons/tool.svg",
        toneVar: "--implementation",
        bgVar: "--implementation-bg",
        borderVar: "--implementation-border"
    },
    rule: {
        label: "Rule",
        description: "User-defined rule commands and compliance checks",
        icon: "/icons/shield-check.svg",
        toneVar: "--rule",
        bgVar: "--rule-bg",
        borderVar: "--rule-border"
    },
    background: {
        label: "Background",
        description: "Subagent and background lifecycle activity",
        icon: "/icons/layers.svg",
        toneVar: "--background",
        bgVar: "--background-bg",
        borderVar: "--background-border"
    }
};
export function getLaneTheme(lane: TimelineLane): LaneTheme {
    return (LANE_THEME as Partial<Record<TimelineLane, LaneTheme>>)[lane] ?? LANE_THEME["background"];
}
