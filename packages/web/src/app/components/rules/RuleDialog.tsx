import type React from "react";
import { useEffect } from "react";
import type { RuleCreateInput, RuleRecord, RuleScope, TaskId } from "../../../types.js";
import { Button } from "../ui/Button.js";
import { RuleForm } from "./RuleForm.js";

interface RuleDialogProps {
    readonly mode: "create" | "edit";
    readonly open: boolean;
    readonly defaultScope: RuleScope;
    readonly defaultTaskId?: TaskId;
    readonly initial?: RuleRecord;
    readonly busy?: boolean;
    readonly error?: string | null;
    readonly onSubmit: (input: RuleCreateInput) => void;
    readonly onClose: () => void;
}

export function RuleDialog({
    mode,
    open,
    defaultScope,
    defaultTaskId,
    initial,
    busy,
    error,
    onSubmit,
    onClose,
}: RuleDialogProps): React.JSX.Element | null {
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;
    const title = mode === "create" ? "New rule" : "Edit rule";
    const description = defaultScope === "task" && defaultTaskId
        ? "This rule applies to the selected task and is evaluated against its turns."
        : "This rule applies globally and is evaluated against every task turn.";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
            <button
                type="button"
                aria-label="Close rule dialog"
                className="absolute inset-0 bg-[color-mix(in_srgb,var(--text-1)_24%,transparent)] backdrop-blur-[2px]"
                onClick={onClose}
            />
            <section className="relative flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-[680px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]">
                <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
                    <div className="min-w-0">
                        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
                            Verification
                        </p>
                        <h2 className="m-0 mt-1 text-[1rem] font-semibold text-[var(--text-1)]">{title}</h2>
                        <p className="m-0 mt-1 text-[0.78rem] leading-5 text-[var(--text-2)]">{description}</p>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Close"
                        onClick={onClose}
                    >
                        <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="14">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </Button>
                </header>
                <div className="min-h-0 overflow-y-auto px-5 py-4">
                    {error && (
                        <p className="mb-3 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--err)_40%,var(--border))] bg-[color-mix(in_srgb,var(--err)_8%,transparent)] px-3 py-2 text-[0.78rem] font-medium text-[var(--err)]">
                            {error}
                        </p>
                    )}
                    <RuleForm
                        defaultScope={defaultScope}
                        {...(defaultTaskId !== undefined ? { defaultTaskId } : {})}
                        {...(initial !== undefined ? { initial } : {})}
                        onSubmit={onSubmit}
                        onCancel={onClose}
                        busy={busy}
                        submitLabel={mode === "create" ? "Create rule" : "Update rule"}
                    />
                </div>
            </section>
        </div>
    );
}
