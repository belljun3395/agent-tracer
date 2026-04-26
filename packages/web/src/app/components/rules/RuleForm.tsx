import type React from "react";
import { useState } from "react";
import type {
    RuleCreateInput,
    RuleRecord,
    RuleScope,
    RuleSeverity,
    RuleTriggerSource,
    TaskId,
} from "../../../types.js";
import { Button } from "../ui/Button.js";
import {
    getRuleExpectToolPlaceholders,
    normalizeRuleExpectTool,
    RULE_EXPECT_TOOL_OPTIONS,
    supportsCommandMatches,
} from "./ruleExpectTool.js";

interface RuleFormProps {
    readonly defaultScope: RuleScope;
    readonly defaultTaskId?: TaskId;
    readonly initial?: RuleRecord;
    readonly onSubmit: (input: RuleCreateInput) => void;
    readonly onCancel: () => void;
    readonly busy?: boolean | undefined;
    readonly submitLabel?: string;
}

export interface RuleFormDraft {
    readonly name: string;
    readonly severity: RuleSeverity;
    readonly phrases: string;
    readonly triggerOn: RuleTriggerSource | "";
    readonly tool: string;
    readonly commandMatches: string;
    readonly pattern: string;
    readonly rationale: string;
}

export function RuleForm({
    defaultScope,
    defaultTaskId,
    initial,
    onSubmit,
    onCancel,
    busy,
    submitLabel = "Save",
}: RuleFormProps): React.JSX.Element {
    const [name, setName] = useState(initial?.name ?? "");
    const [severity, setSeverity] = useState<RuleSeverity>(initial?.severity ?? "info");
    const [phrases, setPhrases] = useState((initial?.trigger?.phrases ?? []).join("\n"));
    const [triggerOn, setTriggerOn] = useState<RuleTriggerSource | "">(initial?.triggerOn ?? "");
    const [tool, setTool] = useState(normalizeRuleExpectTool(initial?.expect.tool));
    const [commandMatches, setCommandMatches] = useState((initial?.expect.commandMatches ?? []).join("\n"));
    const [pattern, setPattern] = useState(initial?.expect.pattern ?? "");
    const [rationale, setRationale] = useState(initial?.rationale ?? "");
    const draft: RuleFormDraft = {
        name,
        severity,
        phrases,
        triggerOn,
        tool,
        commandMatches,
        pattern,
        rationale,
    };
    const placeholders = getRuleExpectToolPlaceholders(tool);
    const showCommandMatches = supportsCommandMatches(tool);

    const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const input = buildRuleFormInput(draft, defaultScope, defaultTaskId);
        if (!input) return;
        onSubmit(input);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Field label="Name" required>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputClass}
                />
            </Field>
            <div className="grid grid-cols-2 gap-2">
                <Field label="Severity">
                    <select value={severity} onChange={(e) => setSeverity(e.target.value as RuleSeverity)} className={inputClass}>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="block">Block</option>
                    </select>
                </Field>
                <Field label="Trigger on">
                    <select value={triggerOn} onChange={(e) => setTriggerOn(e.target.value as RuleTriggerSource | "")} className={inputClass}>
                        <option value="">(any)</option>
                        <option value="user">User message</option>
                        <option value="assistant">Assistant response</option>
                    </select>
                </Field>
            </div>
            <Field label="Trigger phrases (one per line)">
                <textarea
                    value={phrases}
                    onChange={(e) => setPhrases(e.target.value)}
                    rows={2}
                    className={inputClass}
                    placeholder="e.g., run tests"
                />
            </Field>
            <Field label="Expected action">
                <select
                    value={tool}
                    onChange={(e) => setTool(e.target.value)}
                    className={inputClass}
                >
                    {RULE_EXPECT_TOOL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </Field>
            {showCommandMatches && (
                <Field label="Command matches (one per line, substring)">
                    <textarea
                        value={commandMatches}
                        onChange={(e) => setCommandMatches(e.target.value)}
                        rows={2}
                        className={inputClass}
                        placeholder={placeholders.command}
                    />
                </Field>
            )}
            <Field label="Expect pattern (regex)">
                <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    className={inputClass}
                    placeholder={placeholders.pattern}
                />
            </Field>
            <Field label="Rationale">
                <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    rows={2}
                    className={inputClass}
                />
            </Field>
            <div className="flex items-center justify-end gap-1.5 border-t border-[var(--border)] pt-3">
                <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
                    Cancel
                </Button>
                <Button size="sm" variant="accent" type="submit" disabled={busy || !isRuleFormSubmittable(draft)}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}

export function buildRuleFormInput(
    draft: RuleFormDraft,
    defaultScope: RuleScope,
    defaultTaskId?: TaskId,
): RuleCreateInput | null {
    if (!isRuleFormSubmittable(draft)) return null;
    const phraseList = splitLines(draft.phrases);
    const normalizedTool = normalizeRuleExpectTool(draft.tool);
    const cmdList = supportsCommandMatches(normalizedTool)
        ? splitLines(draft.commandMatches)
        : [];
    const expect: RuleCreateInput["expect"] = {
        ...(normalizedTool ? { tool: normalizedTool } : {}),
        ...(cmdList.length > 0 ? { commandMatches: cmdList } : {}),
        ...(draft.pattern.trim() ? { pattern: draft.pattern.trim() } : {}),
    };
    return {
        name: draft.name.trim(),
        ...(phraseList.length > 0 ? { trigger: { phrases: phraseList } } : {}),
        ...(draft.triggerOn ? { triggerOn: draft.triggerOn } : {}),
        expect,
        scope: defaultScope,
        ...(defaultScope === "task" && defaultTaskId ? { taskId: defaultTaskId } : {}),
        severity: draft.severity,
        ...(draft.rationale.trim() ? { rationale: draft.rationale.trim() } : {}),
    };
}

export function isRuleFormSubmittable(draft: RuleFormDraft): boolean {
    if (!draft.name.trim()) return false;
    const normalizedTool = normalizeRuleExpectTool(draft.tool);
    return Boolean(
        normalizedTool ||
        draft.pattern.trim() ||
        (supportsCommandMatches(normalizedTool) && splitLines(draft.commandMatches).length > 0),
    );
}

function splitLines(value: string): string[] {
    return value.split("\n").map((item) => item.trim()).filter((item) => item.length > 0);
}

const inputClass = "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[0.82rem] text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none";

function Field({ label, required, children }: { readonly label: string; readonly required?: boolean; readonly children: React.ReactNode }): React.JSX.Element {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--text-3)]">
                {label}{required && <span className="text-[var(--err)]"> *</span>}
            </span>
            {children}
        </label>
    );
}
