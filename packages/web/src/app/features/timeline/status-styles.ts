export const OBSERVABILITY_BADGE_STYLES = {
    actions: "border-[var(--implementation-border)] bg-[var(--implementation-bg)] text-[var(--implementation)]",
    coordination: "border-[var(--coordination-border)] bg-[var(--coordination-bg)] text-[var(--coordination)]",
    files: "border-[var(--exploration-border)] bg-[var(--exploration-bg)] text-[var(--exploration)]",
    compacts: "border-[color-mix(in_srgb,var(--planning)_28%,white)] bg-[color-mix(in_srgb,var(--planning)_10%,white)] text-[var(--planning)]",
    checks: "border-[var(--coordination-border)] bg-[var(--coordination-bg)] text-[var(--coordination)]",
    violations: "border-[#fecaca] bg-[#fef2f2] text-[var(--err)]",
    passes: "border-[#bbf7d0] bg-[#f0fdf4] text-[var(--ok)]"
} as const;

export const TASK_STATUS_BUTTON_STYLES = {
    running: {
        active: "border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok)]",
        idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--ok)] hover:bg-[var(--ok-bg)]/70 hover:text-[var(--ok)]"
    },
    waiting: {
        active: "border-[#d97706] bg-[#fef3c7] text-[#b45309]",
        idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[#d97706] hover:bg-[#fef3c7] hover:text-[#b45309]"
    },
    completed: {
        active: "border-[var(--done)] bg-[var(--done-bg)] text-[var(--done)]",
        idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--done)] hover:bg-[var(--done-bg)]/70 hover:text-[var(--done)]"
    },
    errored: {
        active: "border-[var(--err)] bg-[var(--err-bg)] text-[var(--err)]",
        idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--err)] hover:bg-[var(--err-bg)]/70 hover:text-[var(--err)]"
    }
} as const;

export type { TimelineObservabilityStats } from "./types.js";

export function formatTaskStatusLabel(status: "running" | "waiting" | "completed" | "errored"): string {
    switch (status) {
        case "running":
            return "Running";
        case "waiting":
            return "Waiting";
        case "completed":
            return "Completed";
        case "errored":
            return "Errored";
    }
}
