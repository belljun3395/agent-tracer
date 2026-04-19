import type { WorkflowSummaryRecord, PlaybookSummaryRecord } from "../../../io.js";

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

export function sortPlaybooks(items: readonly PlaybookSummaryRecord[]): readonly PlaybookSummaryRecord[] {
    const rank = (status: PlaybookSummaryRecord["status"]): number => status === "active" ? 3 : status === "draft" ? 2 : 1;
    return [...items].sort((left, right) => rank(right.status) - rank(left.status) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}
