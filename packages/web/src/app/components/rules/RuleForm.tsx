import type React from "react";
import { useState } from "react";
import { Button } from "../ui/Button.js";
import type { CreateRuleInput, PromoteRuleEdits, UpdateRuleInput } from "../../../io/api.js";
import type { RuleScope, RuleSeverity, RuleTriggerOn } from "../../../types.js";

export interface RuleFormValues {
    readonly name: string;
    readonly phrases: string;
    readonly triggerOn: RuleTriggerOn | "";
    readonly tool: string;
    readonly commandMatches: string;
    readonly pattern: string;
    readonly severity: RuleSeverity;
}

export type RuleFormMode = "create" | "edit" | "promote";

export interface RuleFormProps {
    readonly mode: RuleFormMode;
    readonly initial?: { readonly id: string; readonly values: RuleFormValues };
    readonly defaultTaskId?: string;
    readonly onCreate: (input: CreateRuleInput) => Promise<void>;
    readonly onUpdate: (id: string, patch: UpdateRuleInput) => Promise<void>;
    readonly onPromote: (id: string, edits: PromoteRuleEdits) => Promise<void>;
    readonly onCancel: () => void;
}

const HEADER_HINT_PROMOTE =
    "Edit the rule's trigger phrases and expectations to generalise the pattern, then promote to a global rule. Original task rule stays.";
const HEADER_HINT_DEFAULT =
    "A rule fires when the assistant message matches the trigger phrases (or always, if none are set), then checks whether the turn's tool calls satisfy the expectation. You must fill in at least one of Expect tool, Command matches, or Pattern.";

function splitCsv(input: string): string[] {
    return input.split(",").map((s) => s.trim()).filter(Boolean);
}

export function RuleForm({
    mode,
    initial,
    defaultTaskId,
    onCreate,
    onUpdate,
    onPromote,
    onCancel,
}: RuleFormProps): React.JSX.Element {
    const [name, setName] = useState(initial?.values.name ?? "");
    const [phrases, setPhrases] = useState(initial?.values.phrases ?? "");
    const [triggerOn, setTriggerOn] = useState<RuleTriggerOn | "">(initial?.values.triggerOn ?? "");
    const [tool, setTool] = useState(initial?.values.tool ?? "");
    const [commandMatches, setCommandMatches] = useState(initial?.values.commandMatches ?? "");
    const [pattern, setPattern] = useState(initial?.values.pattern ?? "");
    // Scope selector is only relevant when creating from scratch in global mode (no defaultTaskId).
    const initialScope: RuleScope = defaultTaskId !== undefined ? "task" : "global";
    const [scope, setScope] = useState<RuleScope>(initialScope);
    const [taskId, setTaskId] = useState(defaultTaskId ?? "");
    const [severity, setSeverity] = useState<RuleSeverity>(initial?.values.severity ?? "warn");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const phrasesList = splitCsv(phrases);
    const cmdMatchesList = splitCsv(commandMatches);
    const showScopeSelector = mode === "create" && defaultTaskId === undefined;

    const canSubmit =
        name.trim().length > 0 &&
        (tool.trim().length > 0 || pattern.trim().length > 0 || cmdMatchesList.length > 0) &&
        (mode !== "create" || scope === "global" || taskId.trim().length > 0);

    const submitLabel = mode === "edit"
        ? (submitting ? "Saving…" : "Save")
        : mode === "promote"
            ? (submitting ? "Promoting…" : "Promote to Global")
            : (submitting ? "Creating…" : "Create");

    const headerHint = mode === "promote" ? HEADER_HINT_PROMOTE : HEADER_HINT_DEFAULT;

    async function submit(): Promise<void> {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            if (mode === "edit" && initial) {
                const trigger: { readonly phrases: readonly string[] } | null =
                    phrasesList.length > 0 ? { phrases: phrasesList } : null;
                const expect: UpdateRuleInput["expect"] = {
                    tool: tool.trim() ? tool.trim() : null,
                    commandMatches: cmdMatchesList.length > 0 ? cmdMatchesList : null,
                    pattern: pattern.trim() ? pattern.trim() : null,
                };
                await onUpdate(initial.id, {
                    name: name.trim(),
                    trigger,
                    triggerOn: triggerOn === "" ? null : triggerOn,
                    expect,
                    severity,
                });
            } else if (mode === "promote" && initial) {
                await onPromote(initial.id, {
                    name: name.trim(),
                    ...(phrasesList.length > 0 ? { trigger: { phrases: phrasesList } } : {}),
                    expect: {
                        ...(tool.trim() ? { tool: tool.trim() } : {}),
                        ...(cmdMatchesList.length > 0 ? { commandMatches: cmdMatchesList } : {}),
                        ...(pattern.trim() ? { pattern: pattern.trim() } : {}),
                    },
                    severity,
                });
            } else {
                const effectiveScope: RuleScope = defaultTaskId !== undefined ? "task" : scope;
                const effectiveTaskId = defaultTaskId ?? taskId.trim();
                await onCreate({
                    name: name.trim(),
                    ...(phrasesList.length > 0 ? { trigger: { phrases: phrasesList } } : {}),
                    ...(triggerOn !== "" ? { triggerOn } : {}),
                    expect: {
                        ...(tool.trim() ? { tool: tool.trim() } : {}),
                        ...(cmdMatchesList.length > 0 ? { commandMatches: cmdMatchesList } : {}),
                        ...(pattern.trim() ? { pattern: pattern.trim() } : {}),
                    },
                    scope: effectiveScope,
                    ...(effectiveScope === "task" ? { taskId: effectiveTaskId } : {}),
                    severity,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save rule");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="m-0 rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--surface-2)_60%,var(--surface))] px-3 py-2 text-[0.7rem] leading-5 text-[var(--text-2)]">
                {headerHint}
            </p>
            <label className="text-[0.72rem] text-[var(--text-2)]">Name
                <input
                    className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ran tests"
                    type="text"
                    value={name}
                />
            </label>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-[0.72rem] text-[var(--text-2)]">Trigger phrases (comma-separated, optional)
                    <input
                        className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                        onChange={(e) => setPhrases(e.target.value)}
                        placeholder="ran tests, tests pass"
                        type="text"
                        value={phrases}
                    />
                </label>
                <label className="text-[0.72rem] text-[var(--text-2)]">Trigger on
                    <select
                        className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                        onChange={(e) => setTriggerOn(e.target.value as RuleTriggerOn | "")}
                        value={triggerOn}
                    >
                        <option value="">assistant (default)</option>
                        <option value="assistant">assistant</option>
                        <option value="user">user</option>
                    </select>
                </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-[0.72rem] text-[var(--text-2)]">Expect tool
                    <input
                        className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                        onChange={(e) => setTool(e.target.value)}
                        placeholder="Bash"
                        type="text"
                        value={tool}
                    />
                </label>
                <label className="text-[0.72rem] text-[var(--text-2)]">Severity
                    <select
                        className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                        onChange={(e) => setSeverity(e.target.value as RuleSeverity)}
                        value={severity}
                    >
                        <option value="info">info</option>
                        <option value="warn">warn</option>
                        <option value="block">block</option>
                    </select>
                </label>
            </div>
            <label className="text-[0.72rem] text-[var(--text-2)]">Command matches (comma-separated, optional)
                <input
                    className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                    onChange={(e) => setCommandMatches(e.target.value)}
                    placeholder="jest, vitest"
                    type="text"
                    value={commandMatches}
                />
            </label>
            <label className="text-[0.72rem] text-[var(--text-2)]">Pattern (regex, optional)
                <input
                    className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="auth/.*\\.ts$"
                    type="text"
                    value={pattern}
                />
            </label>
            {showScopeSelector && (
                <div className="grid grid-cols-2 gap-2">
                    <label className="text-[0.72rem] text-[var(--text-2)]">Scope
                        <select
                            className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                            onChange={(e) => setScope(e.target.value as RuleScope)}
                            value={scope}
                        >
                            <option value="global">global</option>
                            <option value="task">task</option>
                        </select>
                    </label>
                    {scope === "task" && (
                        <label className="text-[0.72rem] text-[var(--text-2)]">Task ID
                            <input
                                className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem]"
                                onChange={(e) => setTaskId(e.target.value)}
                                placeholder="task-abc"
                                type="text"
                                value={taskId}
                            />
                        </label>
                    )}
                </div>
            )}
            {error && (
                <p className="m-0 text-[0.72rem] text-[var(--err,#ef4444)]">{error}</p>
            )}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="accent"
                    disabled={!canSubmit || submitting}
                    onClick={() => void submit()}
                >
                    {submitLabel}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
        </div>
    );
}
