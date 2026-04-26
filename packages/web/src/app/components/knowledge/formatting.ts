import type { WorkflowSummaryRecord } from "../../../io.js";

export function formatDate(iso: string | null | undefined): string | null {
    if (!iso) {
        return null;
    }
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function sortSnapshots(items: readonly WorkflowSummaryRecord[]): readonly WorkflowSummaryRecord[] {
    return [...items].sort((left, right) => Date.parse(right.evaluatedAt) - Date.parse(left.evaluatedAt));
}
