# Exploration Category Icons Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add small visual icons to Exploration lane cards on the timeline that identify the type of exploration action (search, read, fetch, shell, list) at a glance — without any server-side changes and in a way that works across any AI agent.

**Primary use case:** Scanning a task's timeline and immediately knowing what kind of exploration was happening — web search, file read, URL fetch, etc. — without parsing card text.

**Architecture:** New `explorationCategory.ts` module (pure function + config array) computes a category from the event's existing data. `Timeline.tsx` reads the result and renders a small icon next to the Exploration lane tag. No server changes required.

**Tech Stack:** React + TypeScript, Tailwind CSS, Vitest.

---

## Scope

### In scope
- New `packages/web/src/lib/explorationCategory.ts`:
  - `EXPLORATION_CATEGORIES` config array (category, icon, patterns)
  - `resolveExplorationCategory(event)` — returns `ExplorationCategory | null`
- Modify `packages/web/src/components/Timeline.tsx`:
  - Show icon next to Exploration lane tag when category resolves
- Unit tests for `resolveExplorationCategory` in `packages/web/src/lib/explorationCategory.test.ts`

### Out of scope
- Server-side changes
- Non-exploration lanes
- Icon SVGs (use emoji — avoids asset pipeline complexity)
- User-facing settings UI for categories

---

## Data Sources

All data is already available on `TimelineEvent`. No new fields required.

| Priority | Source | Example |
|----------|--------|---------|
| 1 | `event.metadata["toolName"]` | `"web_search"`, `"read_file"` |
| 2 | `event.title` prefix (before first `":"`) | `"WebSearch: Java"` → `"websearch"` |
| 3 | `event.classification.tags` — `mcp-tool:xxx` entries | `"mcp-tool:websearch"` |
| 4 | No match | `null` — no icon rendered |

---

## Config Structure

```typescript
// packages/web/src/lib/explorationCategory.ts

export interface ExplorationCategory {
  readonly category: string;
  readonly icon: string;
}

interface ExplorationCategoryRule {
  readonly category: string;
  readonly icon: string;
  readonly patterns: readonly string[];
}

const EXPLORATION_CATEGORIES: readonly ExplorationCategoryRule[] = [
  {
    category: "search",
    icon: "🔍",
    patterns: ["search", "websearch", "web_search", "grep", "find", "glob"]
  },
  {
    category: "read",
    icon: "📄",
    patterns: ["read", "cat", "view", "open", "inspect"]
  },
  {
    category: "fetch",
    icon: "🌐",
    patterns: ["fetch", "curl", "http", "url", "browse", "navigate"]
  },
  {
    category: "shell",
    icon: "⚙️",
    patterns: ["bash", "shell", "run", "execute", "command", "terminal"]
  },
  {
    category: "list",
    icon: "📋",
    patterns: ["list", "ls", "dir", "tree", "scan"]
  },
];
```

---

## Matching Logic

### Normalization
Strip underscores, hyphens, and spaces, then lowercase:
```typescript
function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-\s]/g, "");
}
```

This makes `"web_search"`, `"web-search"`, `"WebSearch"`, `"websearch"` all equivalent.

### resolveExplorationCategory

```typescript
export function resolveExplorationCategory(
  event: Pick<TimelineEvent, "metadata" | "title" | "classification">
): ExplorationCategory | null
```

Note: the lane guard (`lane === "exploration"`) is the caller's responsibility (Timeline.tsx). The function itself does not receive `lane` — it matches purely on event content.

**Step 1 — toolName:** If `event.metadata["toolName"]` is a non-empty string, normalize it and check each category in `EXPLORATION_CATEGORIES` order. Return the **first** category whose patterns array contains a pattern `p` where `normalizedInput.includes(p) || p.includes(normalizedInput)`.

**Step 2 — title prefix:** If step 1 produced no match, extract the substring before the first `":"` in `event.title` (or the entire title if no `":"` is present — including empty string, which silently produces no match). Normalize and run the same first-match scan.

**Step 3 — tags:** If step 2 produced no match, find the first tag in `event.classification.tags` that starts with `"mcp-tool:"`. Extract the suffix (`tag.slice("mcp-tool:".length)`), normalize, and run the same first-match scan.

**Step 4 — null:** Return `null` if no step matched.

**Matching rule:** A pattern `p` matches normalized input `n` if `n.includes(p) || p.includes(n)`. This handles both directions — `"websearch"` matches pattern `"search"` (n contains p), and `"search"` matches tool name `"my_search_tool"` (n contains p). **First match in `EXPLORATION_CATEGORIES` array order wins** — when a tool name satisfies patterns in multiple categories, the earlier entry in the array takes precedence.

### Extensibility

To support a new agent with tool name `"document_reader"`:
- No config change needed — `"read"` pattern already matches via `includes`

To add a new category (e.g., database queries):
```typescript
{ category: "db", icon: "🗄️", patterns: ["query", "sql", "select", "database"] }
```
Add one entry to `EXPLORATION_CATEGORIES` — no other changes.

---

## Rendering

### Card layout change

**Before:**
```
┌─────────────────────────────────┐
│ • EXPLORATION              12s  │
│ WebSearch: Java latest          │
└─────────────────────────────────┘
```

**After (with match):**
```
┌─────────────────────────────────┐
│ • EXPLORATION  🔍          12s  │
│ WebSearch: Java latest          │
└─────────────────────────────────┘
```

**After (no match):**
```
┌─────────────────────────────────┐
│ • EXPLORATION              12s  │  ← unchanged
│ Read: package.json              │
└─────────────────────────────────┘
```

### Implementation detail

In `Timeline.tsx`, inside the card render function:
1. Check `event.lane === "exploration"` first — skip for all other lanes
2. Call `resolveExplorationCategory(event)` → `category | null`
3. If non-null, render `<span className="text-[0.75rem] opacity-70">{category.icon}</span>` immediately after the lane tag element
4. If null, render nothing — no empty placeholder

---

## New Files

### `packages/web/src/lib/explorationCategory.ts`

Exports:
- `ExplorationCategory` interface
- `resolveExplorationCategory(event): ExplorationCategory | null`

`EXPLORATION_CATEGORIES` config is NOT exported — it is an implementation detail. To extend, edit this file.

### `packages/web/src/lib/explorationCategory.test.ts`

Unit tests covering:
- toolName exact match (`"web_search"` → search icon)
- toolName normalized match (`"WebSearch"` → search icon)
- title prefix match (`"WebSearch: Java"` → search icon, `"Read: file.ts"` → read icon)
- tags match (`"mcp-tool:websearch"` → search icon)
- null on non-exploration event (lane !== "exploration")
- null on no match (unrecognized tool)
- Priority: toolName wins over title when both present

---

## Modified Files

### `packages/web/src/components/Timeline.tsx`

- Import `resolveExplorationCategory` from `"../lib/explorationCategory.js"`
- In exploration card render: call resolver, conditionally render icon span
- Change is additive — no existing behavior removed

---

## Error Handling

- `metadata["toolName"]` not a string → skip step 1 gracefully
- `event.title` has no `":"` → skip step 2 gracefully (treat whole title as the key)
- `classification.tags` empty → skip step 3 gracefully
- Any unexpected input → return `null` (no icon, safe fallback)

---

## Testing Notes

- Unit test `resolveExplorationCategory` with `makeEvent` helper from `insights.test.ts` pattern
- Test all 3 matching paths independently
- Test priority order (toolName before title)
- Test normalization: `"web_search"` and `"websearch"` and `"WebSearch"` all produce same result
- Test null cases: no match
- Test title with no `":"` — full title used as key (e.g., `"websearch"` → search category)
- Test first-match wins when tool name could match multiple categories (e.g., `"read_list"` → `"read"` category wins because it appears first in the array)
- No UI snapshot tests — visual verification sufficient
