import type { VerdictStatus } from "./types.js";

export interface VerdictStyle {
    readonly borderColor: string;
    readonly chipBg: string;
    readonly chipFg: string;
}

export function verdictStyle(v: VerdictStatus | null): VerdictStyle {
    switch (v) {
        case "contradicted": return { borderColor: "#dc2626", chipBg: "#fee2e2", chipFg: "#b91c1c" };
        case "unverifiable": return { borderColor: "#f59e0b", chipBg: "#fef3c7", chipFg: "#b45309" };
        case "verified":     return { borderColor: "#94a3b8", chipBg: "#f1f5f9", chipFg: "#475569" };
        default:             return { borderColor: "#94a3b8", chipBg: "#f1f5f9", chipFg: "#64748b" };
    }
}

export function verdictIcon(v: VerdictStatus | null): string {
    switch (v) {
        case "contradicted": return "✗";
        case "unverifiable": return "⚠";
        case "verified":     return "✓";
        default:             return "·";
    }
}

export function verdictLabel(v: VerdictStatus | null): string {
    switch (v) {
        case "contradicted": return "contradicted";
        case "unverifiable": return "unverifiable";
        case "verified":     return "verified";
        default:             return "no rules";
    }
}
