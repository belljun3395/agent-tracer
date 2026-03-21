# Copy for AI — Task Handoff Panel Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a richer inline "Copy for AI" accordion panel below the existing TaskExtraction card in the Task tab. Lets users compose, preview, and copy structured AI-ready context from a monitored task. Existing `Copy brief` / `Copy process` buttons are kept as fast-path shortcuts.

**Primary use case:** Passing context to an AI agent — either to resume the same task in a new session, or to delegate a subtask to a fresh agent.

**Architecture:** Accordion panel inside the existing Task tab, rendered below the TaskExtraction card. State (format, section toggles) is persisted to localStorage with a default-merge guard. Memo is intentionally not persisted. New `TaskHandoffPanel` component extracted from EventInspector to keep file size manageable. New builder functions and one new data-extraction helper added to `insights.ts`.

**Tech Stack:** React + TypeScript, Tailwind CSS, existing `insights.ts` data pipeline, localStorage for preferences.

---

## Scope

### In scope
- `TaskHandoffPanel` component (new file)
- 4 copy formats: Plain, Markdown, XML, System Prompt
- Section toggles: Summary, Process, Files, Modified Files, Open TODOs, Violations, Questions
- Handoff memo textarea (free text, user-authored, not persisted)
- Live preview of generated output
- localStorage persistence of format + section preferences (with default-merge)
- New exported functions in `insights.ts`:
  - `buildHandoffXML(options)`
  - `buildHandoffSystemPrompt(options)`
  - `buildHandoffPlain(options)` — replaces `buildTaskBrief` logic
  - `buildHandoffMarkdown(options)` — replaces `buildTaskProcessMarkdown` logic
  - `collectViolationDescriptions(timeline)` — exported helper for violation text extraction
- Keep existing `Copy brief` / `Copy process` buttons as fast-path shortcuts

### Out of scope
- Saving handoff templates by name
- Sending directly to another agent (clipboard only)
- Git diff integration (modified files come from existing `FileActivityStat.writeCount`, not git)

---

## Data Sources

All data is already computed and available inside EventInspector's render scope. No new API calls needed. EventInspector pre-computes the derived strings before passing to `TaskHandoffPanel`.

| Section | Source | Notes |
|---------|--------|-------|
| Objective | `taskExtraction.objective` | Always included, no toggle |
| Summary | `taskExtraction.summary` | Toggle: default ON |
| Process steps | `taskExtraction.sections` | Toggle: default ON |
| Explored files | `collectExploredFiles(timeline).map(f => f.path)` | Toggle: default ON. **Not** capped at 6 — uses full list from `collectExploredFiles`, not `taskExtraction.files` |
| Modified files | `collectFileActivity(timeline).filter(f => f.writeCount > 0).map(f => f.path)` | Toggle: default ON |
| Open TODOs | `todoGroups.filter(g => !g.isTerminal).map(g => g.title)` | Toggle: default ON. `TodoGroup.isTerminal` covers the `completed` / `cancelled` terminal states. |
| Open questions | `questionGroups.flatMap(g => g.phases).filter(p => p.phase === "asked").map(p => p.event.body ?? p.event.title ?? "")` | Toggle: default OFF |
| Violations | `collectViolationDescriptions(taskTimeline)` — new exported helper | Toggle: default ON when count > 0 |
| Handoff memo | Local textarea state | Not persisted |

### `collectViolationDescriptions` specification

New exported function in `insights.ts`:

```typescript
export function collectViolationDescriptions(timeline: readonly TimelineEvent[]): readonly string[] {
  return timeline
    .filter(e =>
      (e.kind === "verification.logged" && e.metadata["verificationStatus"] === "fail") ||
      (e.kind === "rule.logged" && e.metadata["ruleStatus"] === "violation")
    )
    .map(e => e.title ?? e.body ?? "Violation detected")
    .filter(Boolean);
}
```

This replaces the previously proposed `violationEvents: TimelineEvent[]` prop — EventInspector calls this helper and passes the resulting `readonly string[]` to `TaskHandoffPanel`.

---

## Format Specs

All formats guard against empty arrays — sections with no items are omitted entirely (no empty headers).

### Plain
Compact single-line-per-item. Good for pasting inline into chat.

```
Task: <objective>
Summary: <summary>                   ← omitted if include.summary = false or summary empty
Process:                             ← omitted if include.process = false or sections empty
- <lane>: <item>
Explored Files: <file>, <file>       ← omitted if include.files = false or empty
Modified Files: <file>, <file>       ← omitted if include.modifiedFiles = false or empty
Open TODOs:                          ← omitted if include.todos = false or empty
- <todo>
Violations:                          ← omitted if include.violations = false or empty
- <violation>
Open Questions:                      ← omitted if include.questions = false or empty
- <question>
Note: <handoff_memo>                 ← omitted if memo is blank
```

### Markdown
Extends current `buildTaskProcessMarkdown`. Adds all new sections.

```markdown
# Task Context

## Objective
<objective>

## Summary
<summary>

## Process
### <section title>
- <item>

## Explored Files
- `<path>`

## Modified Files
- `<path>`

## Open TODOs
- <todo>

## Violations
- <violation>

## Open Questions
- <question>

## Handoff Note
<memo>
```

### XML *(default)*
Structured for Claude. Uses `<![CDATA[]]>` wrappers to safely embed arbitrary text.

```xml
<context>
  <objective><![CDATA[...]]></objective>
  <summary><![CDATA[...]]></summary>           <!-- omitted if not included -->
  <process>                                     <!-- omitted if not included or empty -->
    <section lane="exploration" title="Exploration">
      <step><![CDATA[...]]></step>
    </section>
  </process>
  <explored_files>                              <!-- omitted if not included or empty -->
    <file>packages/web/src/App.tsx</file>
  </explored_files>
  <modified_files>                              <!-- omitted if not included or empty -->
    <file>packages/web/src/Timeline.tsx</file>
  </modified_files>
  <open_todos>                                  <!-- omitted if not included or empty -->
    <todo><![CDATA[...]]></todo>
  </open_todos>
  <violations count="2">                        <!-- omitted if not included or empty -->
    <violation><![CDATA[...]]></violation>
  </violations>
  <open_questions>                              <!-- omitted if not included or empty -->
    <question><![CDATA[...]]></question>
  </open_questions>
  <handoff_note><![CDATA[...]]></handoff_note>  <!-- omitted if memo blank -->
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

## Process steps
- <lane>: <item>

## Files explored
- <path>

## Files modified
- <path>

## What still needs to be done
- <todo>

## Watch out for
- <violation>

## Open questions
- <question>

## Note from previous session
<memo>

Begin by acknowledging you have read this context, then ask what to tackle first.
```

---

## UI Design

### Layout
The panel lives inside the Task tab, below the existing `TaskExtractionCard`. It is an accordion — collapsed by default, expands on click. Hidden entirely if `taskExtraction.objective` is empty.

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
- Accordion opens with smooth height transition (CSS max-height or `display` toggle)
- Section checkboxes update preview in real time (no debounce needed, output is small)
- Format buttons are a segmented control (one active at a time)
- Preview uses `<pre>` with `overflow-x: auto`, `whitespace: pre`, `font-mono`
- "Copy for AI" button shows "Copied ✓" for 2s then resets
- **Disabled** when all sections are unchecked AND memo is blank
- Preferences (format + sections) saved to `localStorage` key `agent-tracer.handoff-prefs`
- On load, merge persisted prefs with defaults: `{ ...DEFAULT_HANDOFF_PREFS, ...parsed }` — this ensures new sections added in future releases default to ON without requiring migration code
- Memo is intentionally NOT persisted — blank on every open

---

## New Files

### `packages/web/src/components/TaskHandoffPanel.tsx`

Self-contained component. All data is pre-computed by EventInspector before being passed as props.

```typescript
interface TaskHandoffPanelProps {
  readonly objective: string;
  readonly summary: string;
  readonly sections: readonly TaskProcessSection[];
  readonly exploredFiles: readonly string[];
  readonly modifiedFiles: readonly string[];
  readonly openTodos: readonly string[];
  readonly openQuestions: readonly string[];
  readonly violations: readonly string[];
}
```

The component owns all panel state internally: `isOpen`, `memo`, `format`, `include`.

---

## Modified Files

### `packages/web/src/lib/insights.ts`

Add five new exported items:

```typescript
// New data extraction helper
export function collectViolationDescriptions(timeline: readonly TimelineEvent[]): readonly string[]

// New builder interface
export interface HandoffOptions {
  readonly objective: string;
  readonly summary: string;
  readonly sections: readonly TaskProcessSection[];
  readonly exploredFiles: readonly string[];
  readonly modifiedFiles: readonly string[];
  readonly openTodos: readonly string[];
  readonly openQuestions: readonly string[];
  readonly violations: readonly string[];
  readonly memo: string;
  readonly include: {
    readonly summary: boolean;
    readonly process: boolean;
    readonly files: boolean;       // explored files
    readonly modifiedFiles: boolean;
    readonly todos: boolean;
    readonly violations: boolean;
    readonly questions: boolean;
    // objective has no toggle — always included
  };
}

// New format builders
export function buildHandoffPlain(options: HandoffOptions): string
export function buildHandoffMarkdown(options: HandoffOptions): string
export function buildHandoffXML(options: HandoffOptions): string
export function buildHandoffSystemPrompt(options: HandoffOptions): string
```

All four builders guard against empty arrays — a section is omitted entirely if its array is empty or its `include` flag is false.

### `packages/web/src/components/EventInspector.tsx`

Add five `useMemo` hooks **at the top level of `EventInspector`** (not inside a tab branch — React Rules of Hooks prohibit conditional hook calls). Place them alongside the existing `taskExtraction`, `todoGroups`, `questionGroups` memos:

```typescript
// ── Handoff panel data (top-level memos, not inside tab render) ──
const handoffExploredFiles = useMemo(
  () => collectExploredFiles(taskTimeline).map(f => f.path),
  [taskTimeline]
);
const handoffModifiedFiles = useMemo(
  () => collectFileActivity(taskTimeline).filter(f => f.writeCount > 0).map(f => f.path),
  [taskTimeline]
);
const handoffOpenTodos = useMemo(
  () => todoGroups.filter(g => !g.isTerminal).map(g => g.title),
  [todoGroups]
);
const handoffOpenQuestions = useMemo(
  () => questionGroups
    .flatMap(g => g.phases)
    .filter(p => p.phase === "asked")
    .map(p => p.event.body ?? p.event.title ?? "")
    .filter(Boolean),
  [questionGroups]
);
const handoffViolations = useMemo(
  () => collectViolationDescriptions(taskTimeline),
  [taskTimeline]
);
```

Then inside the `"task"` tab render, after `TaskExtractionCard`:

```typescript
{taskExtraction.objective && (
  <TaskHandoffPanel
    objective={taskExtraction.objective}
    summary={taskExtraction.summary}
    sections={taskExtraction.sections}
    exploredFiles={handoffExploredFiles}
    modifiedFiles={handoffModifiedFiles}
    openTodos={handoffOpenTodos}
    openQuestions={handoffOpenQuestions}
    violations={handoffViolations}
  />
)}
```

---

## Error Handling
- Accordion is hidden if `objective` is empty (no task data yet)
- "Copy for AI" button disabled when all sections off AND memo blank
- Empty arrays for any section cause that section to be omitted from all format outputs
- Clipboard write failure: silent no-op, same pattern as existing copy buttons
- Malformed `localStorage` value: catch JSON.parse error, fall back to `DEFAULT_HANDOFF_PREFS`

---

## Testing Notes
- Unit test for `collectViolationDescriptions`: verify `verification.logged` with `fail` status and `rule.logged` with `violation` status are both captured; confirmed events with other statuses are excluded
- Unit test for each of the 4 builders with: (a) all sections populated, (b) all sections empty, (c) mixed
- Unit test: verify empty arrays produce no section header in output (no dangling `Process:` with nothing after)
- Unit test: verify `include.summary = false` removes summary from output across all formats
- UI test: toggle a checkbox → preview text updates
- UI test: change format → preview switches format
- UI test: localStorage persist/restore of format + sections; memo does NOT restore
- UI test: default-merge — stored prefs with missing `questions` key → defaults to `false`
