# Exploration Category Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small icon (🔍 📄 🌐 ⚙️ 📋) next to the lane tag on Exploration lane timeline cards to identify the type of action at a glance.

**Architecture:** New `explorationCategory.ts` module holds a config array + pure `resolveExplorationCategory` function. `Timeline.tsx` calls it when rendering exploration cards and conditionally renders an icon span. No server changes.

**Tech Stack:** React + TypeScript, Vitest, Tailwind CSS.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/web/src/lib/explorationCategory.ts` | Config array + `resolveExplorationCategory` function |
| Create | `packages/web/src/lib/explorationCategory.test.ts` | Unit tests for all matching paths |
| Modify | `packages/web/src/components/Timeline.tsx` | Import resolver, render icon after lane tag on exploration cards |

---

## Task 1: Create `explorationCategory.ts` with config and resolver (TDD)

**Files:**
- Create: `packages/web/src/lib/explorationCategory.ts`
- Create: `packages/web/src/lib/explorationCategory.test.ts`

### Step 1: Write failing tests

Create `packages/web/src/lib/explorationCategory.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { TimelineEvent } from "../types.js";
import { resolveExplorationCategory } from "./explorationCategory.js";

// Minimal event stub — only the fields resolveExplorationCategory uses
function makeEvent(overrides: {
  metadata?: Record<string, unknown>;
  title?: string;
  tags?: readonly string[];
}): Pick<TimelineEvent, "metadata" | "title" | "classification"> {
  return {
    metadata: overrides.metadata ?? {},
    title: overrides.title ?? "",
    classification: {
      lane: "exploration",
      tags: overrides.tags ?? [],
      matches: []
    }
  };
}

describe("resolveExplorationCategory", () => {
  // ── toolName matching ──────────────────────────────────────────────

  it("matches web_search toolName to search category", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "web_search" } }));
    expect(result).toEqual({ category: "search", icon: "🔍" });
  });

  it("matches WebSearch toolName (mixed case, no separator) to search category", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "WebSearch" } }));
    expect(result).toEqual({ category: "search", icon: "🔍" });
  });

  it("matches read_file toolName to read category", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "read_file" } }));
    expect(result).toEqual({ category: "read", icon: "📄" });
  });

  it("matches fetch toolName to fetch category", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "fetch" } }));
    expect(result).toEqual({ category: "fetch", icon: "🌐" });
  });

  it("matches bash toolName to shell category", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "bash" } }));
    expect(result).toEqual({ category: "shell", icon: "⚙️" });
  });

  it("matches list_files toolName to list category", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "list_files" } }));
    expect(result).toEqual({ category: "list", icon: "📋" });
  });

  // ── title prefix matching (step 2 fallback) ────────────────────────

  it("matches 'WebSearch: Java latest' title to search category when no toolName", () => {
    const result = resolveExplorationCategory(makeEvent({ title: "WebSearch: Java latest versions" }));
    expect(result).toEqual({ category: "search", icon: "🔍" });
  });

  it("matches 'Read: package.json' title to read category when no toolName", () => {
    const result = resolveExplorationCategory(makeEvent({ title: "Read: package.json" }));
    expect(result).toEqual({ category: "read", icon: "📄" });
  });

  it("matches title with no colon using full title as key", () => {
    const result = resolveExplorationCategory(makeEvent({ title: "websearch" }));
    expect(result).toEqual({ category: "search", icon: "🔍" });
  });

  // ── tags matching (step 3 fallback) ───────────────────────────────

  it("matches mcp-tool:websearch tag to search category", () => {
    const result = resolveExplorationCategory(makeEvent({ tags: ["mcp-tool:websearch"] }));
    expect(result).toEqual({ category: "search", icon: "🔍" });
  });

  it("matches mcp-tool:read_file tag to read category", () => {
    const result = resolveExplorationCategory(makeEvent({ tags: ["tool.used", "mcp-tool:read_file"] }));
    expect(result).toEqual({ category: "read", icon: "📄" });
  });

  // ── priority ──────────────────────────────────────────────────────

  it("toolName wins over title when both are present", () => {
    // toolName says "fetch", title says "Read: ..."
    const result = resolveExplorationCategory(makeEvent({
      metadata: { toolName: "fetch" },
      title: "Read: some-url"
    }));
    expect(result).toEqual({ category: "fetch", icon: "🌐" });
  });

  it("first-match in array order wins when tool name contains patterns from multiple categories", () => {
    // "read_list" normalizes to "readlist" — contains "read" (index 1) and "list" (index 4)
    // "read" category is earlier in the array, so it wins
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: "read_list" } }));
    expect(result).toEqual({ category: "read", icon: "📄" });
  });

  // ── null cases ────────────────────────────────────────────────────

  it("returns null when nothing matches", () => {
    const result = resolveExplorationCategory(makeEvent({
      metadata: { toolName: "unknown_action_xyz" },
      title: "Doing something"
    }));
    expect(result).toBeNull();
  });

  it("returns null when metadata, title, and tags are all empty", () => {
    const result = resolveExplorationCategory(makeEvent({}));
    expect(result).toBeNull();
  });

  it("returns null when toolName is not a string", () => {
    const result = resolveExplorationCategory(makeEvent({ metadata: { toolName: 42 } }));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm RED**

```bash
cd /path/to/agent-tracer && npm run test 2>&1 | grep -A5 "explorationCategory"
```
Expected: FAIL — `resolveExplorationCategory is not a function` (or module not found).

- [ ] **Step 3: Implement `explorationCategory.ts`**

Create `packages/web/src/lib/explorationCategory.ts`:

```typescript
import type { TimelineEvent } from "../types.js";

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
  { category: "search", icon: "🔍", patterns: ["search", "websearch", "web_search", "grep", "find", "glob"] },
  { category: "read",   icon: "📄", patterns: ["read", "cat", "view", "open", "inspect"] },
  { category: "fetch",  icon: "🌐", patterns: ["fetch", "curl", "http", "url", "browse", "navigate"] },
  { category: "shell",  icon: "⚙️", patterns: ["bash", "shell", "run", "execute", "command", "terminal"] },
  { category: "list",   icon: "📋", patterns: ["list", "ls", "dir", "tree", "scan"] },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-\s]/g, "");
}

function matchCategory(input: string): ExplorationCategory | null {
  const n = normalize(input);
  if (!n) return null;
  for (const rule of EXPLORATION_CATEGORIES) {
    for (const pattern of rule.patterns) {
      const p = normalize(pattern);
      if (n.includes(p) || p.includes(n)) {
        return { category: rule.category, icon: rule.icon };
      }
    }
  }
  return null;
}

export function resolveExplorationCategory(
  event: Pick<TimelineEvent, "metadata" | "title" | "classification">
): ExplorationCategory | null {
  // Step 1: metadata.toolName
  const toolName = event.metadata["toolName"];
  if (typeof toolName === "string" && toolName.length > 0) {
    const match = matchCategory(toolName);
    if (match) return match;
  }

  // Step 2: title prefix (before first ":", or full title if no ":")
  const colonIndex = event.title.indexOf(":");
  const titleKey = colonIndex === -1 ? event.title : event.title.slice(0, colonIndex);
  if (titleKey.trim().length > 0) {
    const match = matchCategory(titleKey.trim());
    if (match) return match;
  }

  // Step 3: mcp-tool: tags
  const mcpToolTag = event.classification.tags.find(t => t.startsWith("mcp-tool:"));
  if (mcpToolTag) {
    const suffix = mcpToolTag.slice("mcp-tool:".length);
    const match = matchCategory(suffix);
    if (match) return match;
  }

  return null;
}
```

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
npm run test 2>&1 | grep -E "explorationCategory|passed|failed"
```
Expected: all tests pass (the new suite + all existing tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/explorationCategory.ts packages/web/src/lib/explorationCategory.test.ts
git commit -m "feat: add explorationCategory resolver with pattern-based matching"
```

---

## Task 2: Render icon in Timeline.tsx exploration cards

**Files:**
- Modify: `packages/web/src/components/Timeline.tsx`

The relevant section is the event card render (around line 1002–1004). The current structure:

```tsx
<div className="event-node-header">
  <span className="event-node-dot" />
  <span className="event-lane-tag">{item.event.lane}</span>
  {stackCount > 0 && (
    <button className="stack-badge-btn" ...>+{stackCount}</button>
  )}
</div>
```

- [ ] **Step 1: Add import**

At the top of `packages/web/src/components/Timeline.tsx`, add:

```typescript
import { resolveExplorationCategory } from "../lib/explorationCategory.js";
```

Place it with the other local imports (after external library imports).

- [ ] **Step 2: Add icon render after the lane tag**

Find this block (around line 1002–1020):

```tsx
<div className="event-node-header">
  <span className="event-node-dot" />
  <span className="event-lane-tag">{item.event.lane}</span>
  {stackCount > 0 && (
```

Replace with:

```tsx
<div className="event-node-header">
  <span className="event-node-dot" />
  <span className="event-lane-tag">{item.event.lane}</span>
  {item.event.lane === "exploration" && (() => {
    const cat = resolveExplorationCategory(item.event);
    return cat ? (
      <span
        aria-label={cat.category}
        className="text-[0.75rem] opacity-70 select-none leading-none"
        role="img"
        title={cat.category}
      >
        {cat.icon}
      </span>
    ) : null;
  })()}
  {stackCount > 0 && (
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd packages/web && npx tsc --noEmit 2>&1; echo "exit: $?"
```
Expected: `exit: 0`

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/Timeline.tsx
git commit -m "feat: show exploration category icon on timeline cards"
```

---

## Final verification

- [ ] Run all tests

```bash
npm run test 2>&1 | grep -E "Tests|passed|failed"
```
Expected: web package tests all pass (server failures are pre-existing, unrelated).

- [ ] Start dev server and open a task with exploration events. Verify:
  - WebSearch events show 🔍
  - Read events show 📄
  - Shell/Bash events show ⚙️
  - Unrecognized events show no icon (card unchanged)
  - Non-exploration lanes show no icon

- [ ] Push

```bash
git push
```
