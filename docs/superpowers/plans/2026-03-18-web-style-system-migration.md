# Web Styling System Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 `packages/web/src/styles.css` 중심의 전역 스타일 구조를, Tailwind 기반 유틸리티 스타일 + 최소한의 스코프드 CSS로 재구성해 유지보수 비용을 낮춘다.

**Architecture:** 일반적인 레이아웃, 패널, 버튼, 배지, 간격, 타이포그래피는 Tailwind로 옮긴다. 도메인 색상과 레인 의미론은 CSS 변수 + TypeScript 헬퍼로 통합한다. 절대 좌표, SVG, 커넥터, 드래그 상태가 핵심인 타임라인 캔버스는 `Timeline.module.css`에 남겨 하이브리드 구조로 유지한다.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind CSS (official Vite plugin), CSS variables, `clsx`, `tailwind-merge`, Vitest

---

## Success Criteria

- `packages/web/src/styles.css`는 Tailwind 엔트리와 import 조합만 담당하고 100줄 이하로 유지한다.
- 전역 CSS는 토큰/리셋/정말 전역이어야 하는 규칙만 남긴다.
- `TopBar`, `TaskList`, `EventInspector`, `App` 셸은 Tailwind 기반으로 전환한다.
- `Timeline`은 셸은 Tailwind로, 좌표/커넥터/레인 배치는 `Timeline.module.css`로 분리한다.
- 레인별 색상/톤/배지 규칙은 한 곳(`laneTheme.ts`)에서 관리한다.
- `TaskList.tsx`, `TopBar.tsx`, `EventInspector.tsx`의 불필요한 인라인 스타일을 제거한다.
- `packages/web/public/theme-colors.css` 같은 미사용 스타일 자산을 제거한다.
- `npm run lint --workspace @monitor/web`, `npm run test --workspace @monitor/web`, `npm run build --workspace @monitor/web`가 모두 통과한다.

## Constraints and Decisions

- 전면 Tailwind 치환은 하지 않는다. 타임라인의 좌표 기반 스타일은 유틸리티 클래스로 표현하면 가독성이 나빠진다.
- 색상 토큰은 Tailwind theme에 하드코딩하지 말고 CSS 변수 중심으로 유지한다. 이 앱은 “semantic lane colors”가 핵심이기 때문이다.
- 첫 구현 목표는 “스타일 소유권 명확화”이지 “모든 CSS 삭제”가 아니다.
- 새 컴포넌트는 가능한 한 Tailwind utility 조합 + 얇은 primitive 조합으로 구성한다.
- 스타일 변형이 비즈니스 의미를 가지면 문자열 연결 대신 helper/object map을 사용한다.

## File Map

**Create**
- `docs/guide/web-styling.md` — 이후 스타일링 규칙과 경계 문서
- `packages/web/src/styles/tokens.css` — 색상/간격/폰트 CSS 변수
- `packages/web/src/styles/base.css` — reset, element defaults, typography base
- `packages/web/src/styles/legacy.css` — 마이그레이션 중 남겨둘 임시 레거시 규칙
- `packages/web/src/lib/ui/cn.ts` — Tailwind class merge helper
- `packages/web/src/lib/ui/laneTheme.ts` — 레인별 tone/source-of-truth map
- `packages/web/src/lib/ui/laneTheme.test.ts` — lane helper 회귀 테스트
- `packages/web/src/components/ui/Button.tsx` — 공용 버튼 primitive
- `packages/web/src/components/ui/Badge.tsx` — 공용 배지 primitive
- `packages/web/src/components/ui/PanelCard.tsx` — 공용 패널/카드 primitive
- `packages/web/src/components/Timeline.module.css` — 타임라인 전용 geometry/SVG 스타일

**Modify**
- `packages/web/package.json` — Tailwind 및 class helper 의존성 추가
- `packages/web/vite.config.ts` — Tailwind Vite plugin 추가
- `packages/web/src/main.tsx` — 스타일 엔트리 유지 확인
- `packages/web/src/styles.css` — Tailwind import + split CSS import 허브
- `packages/web/src/App.tsx` — app shell, panel wrapper, error banner migration
- `packages/web/src/components/TopBar.tsx` — Tailwind pilot migration
- `packages/web/src/components/TaskList.tsx` — Tailwind pilot migration + inline style 제거
- `packages/web/src/components/EventInspector.tsx` — Tailwind migration + panel/tab shell 정리
- `packages/web/src/components/Timeline.tsx` — hybrid migration (`data-*` + CSS module)
- `packages/web/src/lib/timeline.test.ts` — 필요 시 helper contract 보강

**Delete**
- `packages/web/public/theme-colors.css` — 현재 미사용 파일

## Chunk 1: Foundation

### Task 1: Install Tailwind and establish the build baseline

**Files:**
- Modify: `packages/web/package.json`
- Modify: `packages/web/vite.config.ts`
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Run the current baseline checks**

Run:

```bash
npm run lint --workspace @monitor/web
npm run test --workspace @monitor/web
npm run build --workspace @monitor/web
```

Expected:
- lint PASS
- test PASS
- build PASS

- [ ] **Step 2: Start the web app and note the manual QA baseline**

Run:

```bash
npm run dev:web
```

Verify manually:
- Top search dropdown opens and closes correctly
- Sidebar collapse/expand works
- Timeline drag/scroll/zoom works
- Inspector tabs switch correctly
- Bookmark/save/delete actions still respond

- [ ] **Step 3: Add Tailwind and class composition dependencies**

Run:

```bash
npm install --workspace @monitor/web -D tailwindcss @tailwindcss/vite
npm install --workspace @monitor/web clsx tailwind-merge
```

Expected:
- `packages/web/package.json` gains new deps
- lockfile updates only for required packages

- [ ] **Step 4: Register Tailwind’s Vite plugin**

Target diff:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 5: Turn `styles.css` into the root style entrypoint**

Target structure:

```css
@import "tailwindcss";
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/legacy.css";
```

- [ ] **Step 6: Re-run baseline checks**

Run:

```bash
npm run lint --workspace @monitor/web
npm run test --workspace @monitor/web
npm run build --workspace @monitor/web
```

Expected:
- All commands still PASS with zero visual regression

- [ ] **Step 7: Commit the toolchain bootstrap**

```bash
git add package-lock.json packages/web/package.json packages/web/vite.config.ts packages/web/src/styles.css
git commit -m "chore(web): add tailwind styling foundation"
```

### Task 2: Extract tokens and shrink the global blast radius

**Files:**
- Create: `packages/web/src/styles/tokens.css`
- Create: `packages/web/src/styles/base.css`
- Create: `packages/web/src/styles/legacy.css`
- Modify: `packages/web/src/styles.css`
- Delete: `packages/web/public/theme-colors.css`

- [ ] **Step 1: Move all `:root` tokens into `tokens.css`**

Move from current `styles.css`:
- colors: `--bg`, `--surface`, `--border`, `--text-*`
- lane palette: `--user`, `--exploration`, `--planning`, `--implementation`, `--rules`, `--questions`, `--todos`, `--coordination`, `--background`
- state palette: `--ok`, `--done`, `--err`, `--accent`

- [ ] **Step 2: Resolve current token drift**

Fix one of these, but do not leave both undefined:
- define `--bg-2` and `--border-1` in `tokens.css`, or
- replace their usages with already-defined tokens

Acceptance:
- no selector references an undefined CSS variable

- [ ] **Step 3: Move resets and element defaults into `base.css`**

Include only truly global rules:

```css
* { box-sizing: border-box; }
body { margin: 0; }
button, input, label { font: inherit; }
code { ... }
```

- [ ] **Step 4: Move remaining pre-migration rules into `legacy.css`**

Rules that stay temporarily:
- app shell / dashboard grid
- task list legacy classes
- inspector legacy classes
- timeline legacy classes

Acceptance:
- `styles.css` contains imports only
- `legacy.css` becomes the only temporary location for unmigrated selectors

- [ ] **Step 5: Delete the unused theme file**

Delete:

```bash
rm packages/web/public/theme-colors.css
```

Then verify:

```bash
rg -n "theme-colors.css" packages/web
```

Expected:
- no references remain

- [ ] **Step 6: Re-run build/test/lint**

Run:

```bash
npm run lint --workspace @monitor/web
npm run test --workspace @monitor/web
npm run build --workspace @monitor/web
```

- [ ] **Step 7: Commit the CSS split**

```bash
git add packages/web/src/styles.css packages/web/src/styles packages/web/public/theme-colors.css
git commit -m "refactor(web): split global stylesheet into tokens base and legacy layers"
```

### Task 3: Centralize lane and status semantics before UI migration

**Files:**
- Create: `packages/web/src/lib/ui/laneTheme.ts`
- Create: `packages/web/src/lib/ui/laneTheme.test.ts`
- Modify: `packages/web/src/components/TaskList.tsx`
- Modify: `packages/web/src/components/Timeline.tsx`
- Modify: `packages/web/src/components/EventInspector.tsx`

- [ ] **Step 1: Create a single lane theme source-of-truth**

Suggested shape:

```ts
import type { TimelineLane } from "../types.js";

export const LANE_THEME: Record<TimelineLane, {
  readonly label: string;
  readonly toneVar: string;
  readonly bgVar: string;
  readonly borderVar: string;
  readonly icon: string;
}> = {
  exploration: { ... },
  rules: { ... },
  implementation: { ... },
  planning: { ... },
  user: { ... },
  questions: { ... },
  todos: { ... },
  coordination: { ... },
  background: { ... }
};
```

- [ ] **Step 2: Add unit tests for the helper**

Add tests for:
- every `TIMELINE_LANES` entry exists in the map
- each lane defines tone/background/border values
- label/icon regressions are caught

Run:

```bash
npm run test --workspace @monitor/web
```

- [ ] **Step 3: Replace stringly-typed lane style coupling in React**

Refactor these patterns:
- `className={\`filter-chip ${lane}...\`}`
- `className={\`lane-label ${lane}\`}`
- `className={\`event-node ${item.event.lane}...\`}`

Preferred direction:
- use `data-lane={lane}`
- read class variants from `LANE_THEME`
- keep JSX semantic, not CSS-selector-driven

- [ ] **Step 4: Remove duplicated lane selector families from legacy CSS where possible**

Target duplicated families to reduce:
- `.filter-chip.active.<lane>`
- `.lane-label.<lane>`
- `.event-node.<lane>`
- `.connector.<lane>`
- `.arrow-tip.<lane>`

- [ ] **Step 5: Verify semantic correctness in the running UI**

Manual checks:
- lane filter chips still match expected colors
- timeline nodes still show correct lane colors
- connectors and arrow tips still match source lane colors
- inspector tags and badges still show consistent tones

- [ ] **Step 6: Commit semantic consolidation**

```bash
git add packages/web/src/lib/ui/laneTheme.ts packages/web/src/lib/ui/laneTheme.test.ts packages/web/src/components/TaskList.tsx packages/web/src/components/Timeline.tsx packages/web/src/components/EventInspector.tsx packages/web/src/styles/legacy.css
git commit -m "refactor(web): centralize lane styling semantics"
```

## Chunk 2: Component Migration

### Task 4: Introduce reusable Tailwind primitives and migrate app shell

**Files:**
- Create: `packages/web/src/lib/ui/cn.ts`
- Create: `packages/web/src/components/ui/Button.tsx`
- Create: `packages/web/src/components/ui/Badge.tsx`
- Create: `packages/web/src/components/ui/PanelCard.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/components/TopBar.tsx`
- Modify: `packages/web/src/components/TaskList.tsx`

- [ ] **Step 1: Add a class merge helper**

Suggested implementation:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create minimal primitives, not a large design system**

Required primitives:
- `Button`: variants `ghost`, `secondary`, `danger`, `accent`
- `Badge`: variants `status`, `lane`, `outline`, `muted`
- `PanelCard`: consistent radius/border/padding/background wrapper

Rule:
- if a primitive is only used once, do not create it

- [ ] **Step 3: Migrate `App.tsx` shell layout to Tailwind**

Move these concerns first:
- `.app-shell`
- `.dashboard-shell`
- `.sidebar-slot`
- `.main-panel`
- `.error-banner`

Keep dynamic grid width as CSS variable or inline style where needed.

- [ ] **Step 4: Migrate `TopBar.tsx` fully to Tailwind**

Move:
- nav shell
- search input wrapper
- search dropdown
- status indicator
- stats strip and stat cards

Success condition:
- `TopBar.tsx` no longer depends on legacy topnav/stat CSS blocks

- [ ] **Step 5: Migrate `TaskList.tsx` to Tailwind and remove inline UI styles**

Remove inline style objects used only for presentation:
- task list cursor/user-select can stay dynamic, but move visual button reset styles into Tailwind classes
- task row button reset styles should become reusable utility composition
- delete button tone/opacity should be class-driven when possible

Run:

```bash
npm run test --workspace @monitor/web
```

Focus on existing `TaskList.test.ts` to catch accidental behavior changes.

- [ ] **Step 6: Re-run lint/build and manually compare against baseline**

Run:

```bash
npm run lint --workspace @monitor/web
npm run build --workspace @monitor/web
```

Manual checks:
- task selection
- save current task
- delete task
- refresh buttons
- search result popover

- [ ] **Step 7: Commit the shell migration**

```bash
git add packages/web/src/lib/ui/cn.ts packages/web/src/components/ui packages/web/src/App.tsx packages/web/src/components/TopBar.tsx packages/web/src/components/TaskList.tsx packages/web/src/styles/legacy.css
git commit -m "refactor(web): migrate shell and sidebar to tailwind"
```

### Task 5: Migrate the inspector shell and repeated detail UI

**Files:**
- Modify: `packages/web/src/components/EventInspector.tsx`
- Modify: `packages/web/src/components/ui/Badge.tsx`
- Modify: `packages/web/src/components/ui/PanelCard.tsx`
- Modify: `packages/web/src/styles/legacy.css`

- [ ] **Step 1: Convert inspector scaffolding to Tailwind**

Migrate:
- panel tab bar
- tab buttons
- inspector header
- header badge row
- empty state shell
- summary badge row

- [ ] **Step 2: Convert repeated detail card wrappers to primitives**

Targets:
- `DetailSection`
- `DetailIds`
- `DetailTags`
- match lists
- compact/task/rules/tag summary cards

Goal:
- repeated border/padding/head/body styling should come from `PanelCard`, not duplicated CSS selectors

- [ ] **Step 3: Replace trivial inline styles with class composition**

Examples to remove:
- `style={{ margin: 0 }}`
- `style={{ marginLeft: 6, fontWeight: 400 }}`
- `style={{ padding: "0 16px 12px" }}`

Exception:
- drag cursor/user-select state may remain dynamic if it improves clarity

- [ ] **Step 4: Verify tabbed behavior and badge states manually**

Manual checks:
- all tabs render and switch
- bookmark buttons still work
- rules/tags/task/compact/files sections keep spacing and hierarchy
- long metadata blocks remain scrollable and readable

- [ ] **Step 5: Re-run lint/build**

Run:

```bash
npm run lint --workspace @monitor/web
npm run build --workspace @monitor/web
```

- [ ] **Step 6: Commit the inspector migration**

```bash
git add packages/web/src/components/EventInspector.tsx packages/web/src/components/ui packages/web/src/styles/legacy.css
git commit -m "refactor(web): migrate inspector panels to tailwind"
```

### Task 6: Convert timeline to a hybrid Tailwind + CSS module model

**Files:**
- Create: `packages/web/src/components/Timeline.module.css`
- Modify: `packages/web/src/components/Timeline.tsx`
- Modify: `packages/web/src/lib/timeline.test.ts`
- Modify: `packages/web/src/styles/legacy.css`

- [ ] **Step 1: Move timeline-only geometry and SVG selectors into `Timeline.module.css`**

Move selectors for:
- `.timeline-scroll`
- `.timeline-canvas`
- `.timeline-overlay`
- `.lane-row`
- `.lane-track`
- `.now-line`
- `.event-node`
- `.connector`
- `.arrow-tip`

Keep only timeline-specific rules here. Do not mix general button/card typography back into the module.

- [ ] **Step 2: Convert outer timeline shell to Tailwind**

Migrate:
- toolbar
- filters container
- focus strip
- header
- title row
- task status row
- summary badge strip

- [ ] **Step 3: Use `data-*` attributes for semantic state**

Examples:

```tsx
<button
  data-lane={item.event.lane}
  data-active={item.event.id === selectedEvent?.id || undefined}
  data-linked={isLinked || undefined}
/>
```

And in `Timeline.module.css`:

```css
.eventNode[data-lane="exploration"] { border-top-color: var(--exploration); }
.eventNode[data-active="true"] { box-shadow: ...; }
```

- [ ] **Step 4: Keep only truly dynamic numeric layout in inline style**

Allowed inline styles:
- `left`
- `top`
- `width`
- `height`
- cursor during active drag if class indirection adds noise

Disallowed inline styles:
- spacing
- borders
- colors
- typography

- [ ] **Step 5: Re-run timeline helper tests**

Run:

```bash
npm run test --workspace @monitor/web
```

If helper contracts changed, update `timeline.test.ts` only where behavior intentionally changed.

- [ ] **Step 6: Manual QA for timeline-specific interactions**

Verify:
- zoom slider still updates layout
- filter toggles still show/hide lanes
- drag scrolling still works
- connector click selection still works
- now line remains positioned correctly
- selected/linked node states remain visible

- [ ] **Step 7: Commit the hybrid timeline migration**

```bash
git add packages/web/src/components/Timeline.tsx packages/web/src/components/Timeline.module.css packages/web/src/lib/timeline.test.ts packages/web/src/styles/legacy.css
git commit -m "refactor(web): migrate timeline to hybrid scoped styling"
```

## Chunk 3: Cleanup and Verification

### Task 7: Remove obsolete legacy CSS and document the new rules

**Files:**
- Create: `docs/guide/web-styling.md`
- Modify: `packages/web/src/styles/legacy.css`
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Delete all migrated selector blocks from `legacy.css`**

By the end of this task, `legacy.css` should contain only rules that are still intentionally raw CSS.

If empty:
- delete `legacy.css`
- remove its import from `styles.css`

- [ ] **Step 2: Write the style ownership guide**

Add `docs/guide/web-styling.md` with these rules:
- Tailwind for layout, spacing, typography, standard controls
- CSS variables for semantic colors and app-wide tokens
- CSS modules for geometry-heavy or SVG-heavy components only
- `laneTheme.ts` is the only lane tone source-of-truth
- inline style is allowed only for runtime numeric layout values

- [ ] **Step 3: Run the final verification suite**

Run:

```bash
npm run lint --workspace @monitor/web
npm run test --workspace @monitor/web
npm run build --workspace @monitor/web
```

Then run the app:

```bash
npm run dev:web
```

Final manual QA checklist:
- top bar search
- task list selection/save/delete
- sidebar collapse/resizer
- timeline zoom/filter/drag/select/connectors
- inspector tabs/bookmarks/rules/tags
- task title rename/status change

- [ ] **Step 4: Record final before/after metrics in the PR description**

Capture:
- size of `styles.css` before vs after
- number of inline style objects before vs after
- number of global selectors before vs after
- list of remaining non-Tailwind CSS files and why they still exist

- [ ] **Step 5: Commit cleanup and docs**

```bash
git add docs/guide/web-styling.md packages/web/src/styles.css packages/web/src/styles
git commit -m "docs(web): document hybrid tailwind styling conventions"
```

## Execution Notes

- Start with `TopBar` and `TaskList`, not `Timeline`. They are lower-risk and will validate whether the team likes the Tailwind authoring model.
- If the team dislikes utility-heavy JSX after Task 4, stop there and switch the rest of the plan to CSS modules instead of forcing full Tailwind adoption.
- Do not try to redesign the UI during migration. Preserve current visual hierarchy first, then iterate.
- If a class string becomes unreadable, move it into a primitive or a helper. Do not “just accept” utility sprawl.

## Recommended First Slice

If you want the smallest useful spike before committing to the full plan, do only this:

1. Task 1
2. Task 2
3. Task 4 up to `TopBar.tsx` and `TaskList.tsx`

That slice is enough to answer the real question:
"Does Tailwind improve maintainability here without making the timeline worse?"
