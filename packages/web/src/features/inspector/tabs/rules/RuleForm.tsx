import { useState } from "react";
import type {
  RuleCreateInput,
  RuleRecord,
  RuleScope,
  RuleSeverity,
  RuleTriggerSource,
  RuleUpdateInput,
} from "~domain/rule.js";
import type { TaskId } from "~domain/monitoring.js";
import {
  useCreateRuleMutation,
  useUpdateRuleMutation,
} from "~state/server/mutations.js";

interface RuleFormProps {
  /** Existing rule = edit mode; absent = create mode. */
  readonly rule?: RuleRecord;
  /** When creating in task scope, the form pins to this task. */
  readonly defaultTaskId?: TaskId;
  /** When creating, lets the user pick scope (task/global). Edit mode locks scope. */
  readonly defaultScope?: RuleScope;
  readonly onClose: () => void;
}

interface FormState {
  name: string;
  triggerPhrases: string;
  triggerOn: RuleTriggerSource | "";
  expectTool: string;
  expectCommandMatches: string;
  expectPattern: string;
  scope: RuleScope;
  severity: RuleSeverity;
  rationale: string;
}

const SEVERITY_OPTIONS: readonly RuleSeverity[] = ["info", "warn", "block"];
const TRIGGER_ON_OPTIONS: readonly RuleTriggerSource[] = ["user", "assistant"];

function initialState(rule: RuleRecord | undefined, fallbackScope: RuleScope): FormState {
  if (!rule) {
    return {
      name: "",
      triggerPhrases: "",
      triggerOn: "",
      expectTool: "",
      expectCommandMatches: "",
      expectPattern: "",
      scope: fallbackScope,
      severity: "warn",
      rationale: "",
    };
  }
  return {
    name: rule.name,
    triggerPhrases: (rule.trigger?.phrases ?? []).join("\n"),
    triggerOn: rule.triggerOn ?? "",
    expectTool: rule.expect.tool ?? "",
    expectCommandMatches: (rule.expect.commandMatches ?? []).join("\n"),
    expectPattern: rule.expect.pattern ?? "",
    scope: rule.scope,
    severity: rule.severity,
    rationale: rule.rationale ?? "",
  };
}

/**
 * Splits a multi-line textarea on newlines, drops empties + duplicates.
 * Used for both trigger phrases and command-match patterns — both fields
 * accept "one entry per line" UX in the form.
 */
function splitLines(value: string): readonly string[] {
  const seen = new Set<string>();
  for (const raw of value.split(/\r?\n/)) {
    const t = raw.trim();
    if (t && !seen.has(t)) seen.add(t);
  }
  return Array.from(seen);
}

export function RuleForm({
  rule,
  defaultTaskId,
  defaultScope = "global",
  onClose,
}: RuleFormProps) {
  const isEdit = Boolean(rule);
  const [form, setForm] = useState<FormState>(() =>
    initialState(rule, defaultScope),
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateRuleMutation();
  const updateMutation = useUpdateRuleMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: { readonly preventDefault: () => void }) => {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const phrases = splitLines(form.triggerPhrases);
    const cmdMatches = splitLines(form.expectCommandMatches);
    const tool = form.expectTool.trim();
    const pattern = form.expectPattern.trim();
    const rationale = form.rationale.trim();

    if (!tool && cmdMatches.length === 0 && !pattern) {
      setError(
        "Define at least one expectation: tool, a command match, or a pattern.",
      );
      return;
    }

    if (isEdit && rule) {
      const body: RuleUpdateInput = {
        name,
        trigger: phrases.length > 0 ? { phrases } : null,
        triggerOn: form.triggerOn || null,
        expect: {
          tool: tool || null,
          commandMatches: cmdMatches.length > 0 ? cmdMatches : null,
          pattern: pattern || null,
        },
        severity: form.severity,
        rationale: rationale || null,
      };
      updateMutation.mutate(
        { ruleId: rule.id, body },
        {
          onSuccess: () => onClose(),
          onError: (err) => setError(err instanceof Error ? err.message : "Update failed."),
        },
      );
      return;
    }

    const body: RuleCreateInput = {
      name,
      ...(phrases.length > 0 ? { trigger: { phrases } } : {}),
      ...(form.triggerOn ? { triggerOn: form.triggerOn } : {}),
      expect: {
        ...(tool ? { tool } : {}),
        ...(cmdMatches.length > 0 ? { commandMatches: cmdMatches } : {}),
        ...(pattern ? { pattern } : {}),
      },
      scope: form.scope,
      ...(form.scope === "task" && defaultTaskId ? { taskId: defaultTaskId } : {}),
      severity: form.severity,
      ...(rationale ? { rationale } : {}),
    };
    createMutation.mutate(body, {
      onSuccess: () => onClose(),
      onError: (err) => setError(err instanceof Error ? err.message : "Create failed."),
    });
  };

  return (
    // The form footer sticks to the modal bottom so Save/Cancel stays
    // visible even when Trigger phrases + Rationale push the body past
    // the modal's 80vh ceiling. The `position: sticky` plays nicely
    // with the Modal's `overflow: auto` panel — no nested-scroll trap.
    <form
      onSubmit={handleSubmit}
      style={{
        padding: "16px 16px 0",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Field label="Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          placeholder="No raw secrets in commands"
          required
          disabled={isPending}
          style={inputStyle}
        />
      </Field>

      <Row>
        <Field label="Severity">
          <select
            value={form.severity}
            onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value as RuleSeverity }))}
            disabled={isPending}
            style={inputStyle}
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scope">
          <select
            value={form.scope}
            onChange={(e) => setForm((s) => ({ ...s, scope: e.target.value as RuleScope }))}
            disabled={isPending || isEdit}
            style={inputStyle}
          >
            <option value="global">global</option>
            <option value="task" disabled={!defaultTaskId && !isEdit}>
              task{!defaultTaskId && !isEdit ? " (no task selected)" : ""}
            </option>
          </select>
        </Field>
      </Row>

      <SectionHeading
        label="Trigger"
        hint="When should this rule run? Leave both fields empty to match every event."
      />
      <Field label="Phrases" hint="One per line. Leave blank to match always.">
        <textarea
          value={form.triggerPhrases}
          onChange={(e) => setForm((s) => ({ ...s, triggerPhrases: e.target.value }))}
          rows={2}
          disabled={isPending}
          placeholder={`run the migration\napply the patch`}
          style={textareaStyle}
        />
      </Field>

      <Field label="Source" hint="Restrict trigger matching to one side of the conversation.">
        <select
          value={form.triggerOn}
          onChange={(e) =>
            setForm((s) => ({ ...s, triggerOn: e.target.value as RuleTriggerSource | "" }))
          }
          disabled={isPending}
          style={inputStyle}
        >
          <option value="">any</option>
          {TRIGGER_ON_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <SectionHeading
        label="Expectation"
        hint="What should the agent do once triggered? Fill at least one — tool name, command match, or pattern."
      />
      <Field label="Tool name" hint="e.g. apply_patch, bash, write_file. Optional.">
        <input
          type="text"
          value={form.expectTool}
          onChange={(e) => setForm((s) => ({ ...s, expectTool: e.target.value }))}
          disabled={isPending}
          placeholder="apply_patch"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Command matches"
        hint="Substrings expected in the tool's command. One per line."
      >
        <textarea
          value={form.expectCommandMatches}
          onChange={(e) =>
            setForm((s) => ({ ...s, expectCommandMatches: e.target.value }))
          }
          rows={2}
          disabled={isPending}
          placeholder={`migrate up\ndb:seed`}
          style={textareaStyle}
        />
      </Field>

      <Field label="Pattern" hint="Regex, applied to the event payload. Optional.">
        <input
          type="text"
          value={form.expectPattern}
          onChange={(e) => setForm((s) => ({ ...s, expectPattern: e.target.value }))}
          disabled={isPending}
          placeholder="^(?!sk-).*"
          style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
        />
      </Field>

      <Field label="Rationale" hint="Why does this rule exist? Surfaces in violation cards.">
        <textarea
          value={form.rationale}
          onChange={(e) => setForm((s) => ({ ...s, rationale: e.target.value }))}
          rows={3}
          disabled={isPending}
          placeholder="We had a leak in 2025-Q4 — credentials must never be inlined."
          style={textareaStyle}
        />
      </Field>

      {error && (
        <p
          role="alert"
          style={{ margin: 0, fontSize: 12, color: "var(--err)", lineHeight: 1.5 }}
        >
          {error}
        </p>
      )}

      <footer
        style={{
          position: "sticky",
          bottom: 0,
          // Span the modal's full width so the separator hits the panel
          // edges instead of stopping at the form's padding.
          marginLeft: -16,
          marginRight: -16,
          marginTop: 4,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          background: "var(--s1)",
          borderTop: "1px solid var(--hair)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          style={ghostButtonStyle}
        >
          Cancel
        </button>
        <button type="submit" disabled={isPending} style={primaryButtonStyle}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
        </button>
      </footer>
    </form>
  );
}

interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
}

function SectionHeading({
  label,
  hint,
}: {
  readonly label: string;
  readonly hint?: string;
}) {
  return (
    <div
      style={{
        marginTop: 6,
        paddingTop: 8,
        borderTop: "1px solid var(--hair)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "-0.05px",
        }}
      >
        {label}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-subtle)",
            lineHeight: 1.4,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ink-tertiary)",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--err)" }}> *</span>}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: "var(--ink-subtle)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  fontSize: 12.5,
  fontFamily: "inherit",
  color: "var(--ink)",
  background: "var(--canvas)",
  border: "1px solid var(--hair)",
  borderRadius: "var(--radius-xs)",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  lineHeight: 1.5,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--canvas)",
  background: "var(--primary)",
  border: "1px solid var(--primary)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "7px 12px",
  fontSize: 12.5,
  color: "var(--ink-muted)",
  background: "transparent",
  border: "1px solid var(--hair)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
};
