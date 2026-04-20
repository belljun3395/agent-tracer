# Web Styling Guide

## Ownership Rules

- Use Tailwind utility classes for layout, spacing, typography, borders, shadows, and standard control styling.
- Use CSS variables from `packages/web/src/app/styles/tokens.css` for semantic colors and global theme values.
- Use scoped CSS modules only for geometry-heavy, SVG-heavy, or coordinate-driven UI such as the timeline canvas.
- Use inline styles only for runtime numeric values that come from layout calculations or drag state.
- Do not introduce semantic color names ad hoc in JSX; add or reuse a token first.
- Do not keep long duplicated utility strings in large screen components when a shared primitive or style constant would make intent clearer.

## Source of Truth

- `packages/web/src/app/styles.css` is the root style entrypoint only.
- `packages/web/src/app/styles/tokens.css` owns theme variables.
- `packages/web/src/app/styles/base.css` owns reset and element defaults.
- `packages/web/src/app/components/Timeline.css` owns coordinate-heavy timeline canvas styling.
- `packages/web/src/app/styles/legacy.css` is now limited to shared layout hooks that are still easier to express as global selectors, such as inspector collapse and responsive grid behavior.
- `packages/web/src/app/lib/ui/laneTheme.ts` is the only source of truth for lane labels, icons, and semantic tone variables.
- Font loading must use one intentional source of truth. The current default font stack is `Inter` + system sans, with `JetBrains Mono` for code.

## Component Guidance

- Prefer small shared primitives for repeated controls and panels instead of long duplicated class strings.
- Keep Tailwind class composition readable. If a class list stops being obvious, extract a helper or primitive.
- Keep container components focused on behavior and wiring; move repeated presentation blocks into presentational subcomponents.
- For complex view code, prefer extracting badge/pill/card/header/empty-state patterns rather than repeating raw class strings.
- Reserve inline style for width/height/transform/position geometry. Colors, spacing, typography, and state tones belong in classes or tokens.
- Avoid reintroducing global selector coupling from component files.

## Migration Rule

- When converting a component, remove or isolate the matching legacy selector block as soon as the Tailwind or module-based version is verified.
- If a refactor reduces JSX readability by replacing structure with opaque class noise, stop and extract a named primitive instead.
