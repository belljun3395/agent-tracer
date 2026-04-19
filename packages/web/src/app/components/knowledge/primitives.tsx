import React from "react";
import { Eyebrow } from "../ui/Eyebrow.js";

export const tabButtonClass = "rounded-[var(--radius-md)] border px-2 py-0.75 text-[0.68rem] font-semibold transition-colors";
export const editorFieldClass = "flex flex-col gap-1.5";

export function SectionLabel({ children }: { readonly children: React.ReactNode; }): React.JSX.Element {
    return React.createElement(Eyebrow, { className: "text-[0.68rem] tracking-[0.06em]" }, children);
}

export function SnapshotField({ label, value }: {
    readonly label: string;
    readonly value: string | null;
}): React.JSX.Element | null {
    if (!value) {
        return null;
    }
    return React.createElement(
        "div",
        { className: "flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" },
        React.createElement(Eyebrow, null, label),
        React.createElement("p", { className: "m-0 whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[var(--text-1)]" }, value)
    );
}

export function SnapshotList({ label, items }: {
    readonly label: string;
    readonly items: readonly string[];
}): React.JSX.Element | null {
    if (items.length === 0) {
        return null;
    }
    return React.createElement(
        "div",
        { className: "flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" },
        React.createElement(Eyebrow, null, label),
        React.createElement(
            "div",
            { className: "flex flex-col gap-1.5" },
            ...items.map((item) =>
                React.createElement("p", { key: item, className: "m-0 whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[var(--text-1)]" }, `- ${item}`)
            )
        )
    );
}
