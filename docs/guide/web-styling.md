# Web Styling Guide

## Ownership Rules

- Use Tailwind utility classes for layout, spacing, typography, borders, shadows, and standard control styling.
- Use CSS variables from `packages/web/src/styles/tokens.css` for semantic colors and global theme values.
- Use scoped CSS modules only for geometry-heavy, SVG-heavy, or coordinate-driven UI such as the timeline canvas.
- Use inline styles only for runtime numeric values that come from layout calculations or drag state.

## Source of Truth

- `packages/web/src/styles.css` is the root style entrypoint only.
- `packages/web/src/styles/tokens.css` owns theme variables.
- `packages/web/src/styles/base.css` owns reset and element defaults.
- `packages/web/src/components/Timeline.css` owns coordinate-heavy timeline canvas styling.
- `packages/web/src/styles/legacy.css` is now limited to shared layout hooks that are still easier to express as global selectors, such as inspector collapse and responsive grid behavior.
- `packages/web/src/lib/ui/laneTheme.ts` is the only source of truth for lane labels, icons, and semantic tone variables.

## Component Guidance

- Prefer small shared primitives for repeated controls and panels instead of long duplicated class strings.
- Keep Tailwind class composition readable. If a class list stops being obvious, extract a helper or primitive.
- Avoid reintroducing global selector coupling from component files.

## Migration Rule

- When converting a component, remove or isolate the matching legacy selector block as soon as the Tailwind or module-based version is verified.
