# Copy for AI — Task Handoff Panel Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two plain copy buttons (Copy brief / Copy process) with a richer inline "Copy for AI" panel that lets users compose, preview, and copy structured AI-ready context from a monitored task.

**Primary use case:** Passing context to an AI agent — either to resume the same task in a new session, or to delegate a subtask to a fresh agent.

**Architecture:** Accordion panel inside the existing Task tab, rendered below the TaskExtraction card. State (format, section toggles, memo) is persisted to localStorage. New `TaskHandoffPanel` component extracted from EventInspector to keep file size manageable. New format builders added to `insights.ts`.

**Tech Stack:** React + TypeScript, Tailwind CSS, existing `insights.ts` data pipeline, localStorage for preferences.

---

## Scope

### In scope
- `TaskHandoffPanel` component (new file)
- 4 copy formats: Plain, Markdown, XML, System Prompt
- Section toggles: Summary, Process, Files, Modified Files, Open TODOs, Violations, Questions
- Handoff memo textarea (free text, user-authored)
- Live preview of generated output
- localStorage persistence of format + section preferences
- New builder functions in `insights.ts`: `buildHandoffXML`, `buildHandoffSystemPrompt`
- Extend existing `buildTaskBrief` / `buildTaskProcessMarkdown` to accept optional sections + memo
- Keep existing `Copy brief` / `Copy process` buttons as fast-path shortcuts

### Out of scope
- Saving handoff templates by name
- Sending directly to another agent (clipboard only)
- Git diff integration (modified files come from existing `FileActivityStat.writeCount`, not git)

---

## Data Sources

All data is already computed and available as props in EventInspector. No new API calls needed.

| Section | Source | Available? |
|---------|--------|-----------|
| Objective | `taskExtraction.objective` | ✅ |
| Summary | `taskExtraction.summary` | ✅ |
| Process steps | `taskExtraction.sections` | ✅ |
| Explored files | `taskExtraction.files` | ✅ |
| Modified files | `fileActivity.filter(f => f.writeCount > 0).map(f => f.path)` | ✅ (new filter) |
| Open TODOs | `todoGroups` — items where state is not `done` | ✅ |
| Open questions | `questionGroups` — unanswered questions | ✅ |
| Rule violations | `observabilityStats.violations > 0` + violation events from timeline | ✅ |
| Handoff memo | Local textarea state | new |

---

## Format Specs

### Plain
Compact single-line-per-item format. Good for pasting inline into chat.

```
Task: <objective>
Summary: <summary>
Process:
- <lane>: <item>
Modified Files: <file>, <file>
Open TODOs:
- <todo>
Violations: <count> rule violation(s) detected
Note: <handoff_memo>
```

### Markdown
Extends current `buildTaskProcessMarkdown`. Adds Modified Files, Open TODOs, Violations, Note sections.

```markdown
# Task Context

## Objective
<objective>

## Summary
<summary>

## Process
### <section title>
- <item>

## Modified Files
- `<path>`

## Open TODOs
- <todo>

## Violations
- <violation>

## Handoff Note
<memo>
```

### XML *(default)*
Structured for Claude — uses semantic tags, easy to parse with regex or XML tools.

```xml
<context>
  <objective><![CDATA[...]]></objective>
  <summary><![CDATA[...]]></summary>
  <process>
    <section lane="exploration" title="Exploration">
      <step><![CDATA[...]]></step>
    </section>
  </process>
  <modified_files>
    <file>packages/web/src/App.tsx</file>
  </modified_files>
  <open_todos>
    <todo><![CDATA[...]]></todo>
  </open_todos>
  <violations count="2">
    <violation><![CDATA[...]]></violation>
  </violations>
  <handoff_note><![CDATA[...]]></handoff_note>
</context>
```

### System Prompt
Ready to paste directly as a system prompt for a new Claude session.

```
You are continuing a software development task. Below is the full context from the previous session.

## Task
<objective>

## What was done
<summary>

### Process
- <lane>: <item>

## Files modified
- <path>

## What still needs to be done
- <todo>

## Watch out for
- <violation>

## Note from previous session
<memo>

Begin by acknowledging you have read this context, then ask what to tackle first.
```

---

## UI Design

### Layout
The panel lives inside the Task tab, below the existing `TaskExtractionCard`. It is an accordion — collapsed by default, expands on click.

```
┌──────────────────────────────────────────────┐
│ TASK EXTRACTION     [Copy brief] [Copy process]│  ← existing, unchanged
│ [Reusable Task card]                          │
│ [Process sections]                            │
├──────────────────────────────────────────────┤
│ ▼ Copy for AI                                 │  ← accordion header (clickable)
│ ┌────────────────────────────────────────┐   │
│ │ Include                                │   │
│ │ ☑ Summary    ☑ Process   ☑ Files      │   │
│ │ ☑ Modified   ☑ TODOs     ☑ Violations │   │
│ │ ☐ Questions                            │   │
│ │                                        │   │
│ │ Handoff note                           │   │
│ │ ┌──────────────────────────────────┐  │   │
│ │ │ 다음 세션에서 이것부터 시작…       │  │   │
│ │ └──────────────────────────────────┘  │   │
│ │                                        │   │
│ │ Format  [Plain] [Markdown] [XML ✓] [SP]│   │
│ │                                        │   │
│ │ Preview ──────────────────────────     │   │
│ │ ┌──────────────────────────────────┐  │   │
│ │ │ <context>                        │  │   │
│ │ │   <objective>...</objective>     │  │   │
│ │ │   ...                            │  │   │
│ │ │ </context>                       │  │   │
│ │ └──────────────────────────────────┘  │   │
│ │                                        │   │
│ │                    [Copy for AI ✓]    │   │
│ └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Interaction details
- Accordion opens with smooth height transition
- Section checkboxes update preview in real time (no debounce needed, output is small)
- Format buttons are a segmented control (one active at a time)
- Preview uses `<pre>` with horizontal scroll for long lines
- "Copy for AI" button shows "Copied ✓" for 2s then resets
- Preferences (format + sections) saved to localStorage key `agent-tracer.handoff-prefs`
- Memo is NOT persisted — it's per-session, intentionally blank each time

---

## New Files

### `packages/web/src/components/TaskHandoffPanel.tsx`
Self-contained component. Receives the computed data it needs as props. Owns all panel state internally.

```typescript
interface TaskHandoffPanelProps {
  readonly taskExtraction: TaskExtraction;
  readonly todoGroups: readonly TodoGroup[];
  readonly questionGroups: readonly QuestionGroup[];
  readonly fileActivity: readonly FileActivityStat[];
  readonly observabilityStats: { violations: number };
  readonly violationEvents: readonly TimelineEvent[]; // lane=coordination, kind includes violation
}
```

---

## Modified Files

### `packages/web/src/lib/insights.ts`
Add four new exported functions:

```typescript
export function buildHandoffXML(options: HandoffOptions): string
export function buildHandoffSystemPrompt(options: HandoffOptions): string
export function buildHandoffPlain(options: HandoffOptions): string      // extends buildTaskBrief
export function buildHandoffMarkdown(options: HandoffOptions): string   // extends buildTaskProcessMarkdown
```

`HandoffOptions` interface:
```typescript
interface HandoffOptions {
  readonly objective: string;
  readonly summary: string;
  readonly sections: readonly TaskProcessSection[];
  readonly exploredFiles: readonly string[];
  readonly modifiedFiles: readonly string[];
  readonly openTodos: readonly string[];
  readonly openQuestions: readonly string[];
  readonly violations: readonly string[];
  readonly memo: string;
  // which sections to include
  readonly include: {
    summary: boolean;
    process: boolean;
    files: boolean;
    modifiedFiles: boolean;
    todos: boolean;
    violations: boolean;
    questions: boolean;
  };
}
```

### `packages/web/src/components/EventInspector.tsx`
- Import and render `TaskHandoffPanel` below `TaskExtractionCard` in the `"task"` tab
- Pass required props (all already available in EventInspector scope)
- No other changes

---

## Error Handling
- If `taskExtraction.objective` is empty (no task selected), the accordion is hidden entirely
- If all sections are unchecked + memo is empty, "Copy for AI" button is disabled
- Clipboard write failure shows no-op (same as existing copy buttons)

---

## Testing Notes
- Snapshot test for each of the 4 format builders with a representative `HandoffOptions` fixture
- UI test: toggle a checkbox, verify preview text updates
- UI test: change format, verify preview switches format
- Test `fileActivity` filter: only files with `writeCount > 0` appear in Modified Files
