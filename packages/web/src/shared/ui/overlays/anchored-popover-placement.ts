export interface AnchorBounds {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

interface ViewportBounds {
  readonly width: number;
  readonly height: number;
}

interface AnchoredPopoverPlacementInput {
  readonly anchor: AnchorBounds;
  readonly viewport: ViewportBounds;
  readonly preferredWidth: number;
  readonly contentHeight: number;
  readonly preferredMaxHeight: number;
  readonly gutter: number;
  readonly gap: number;
}

export interface AnchoredPopoverPlacement {
  readonly side: "above" | "below";
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
}

export function calculateAnchoredPopoverPlacement({
  anchor,
  viewport,
  preferredWidth,
  contentHeight,
  preferredMaxHeight,
  gutter,
  gap,
}: AnchoredPopoverPlacementInput): AnchoredPopoverPlacement {
  const horizontalGutter = Math.min(
    Math.max(0, gutter),
    Math.max(0, viewport.width / 2),
  );
  const verticalGutter = Math.min(
    Math.max(0, gutter),
    Math.max(0, viewport.height / 2),
  );
  const safeGap = Math.max(0, gap);
  const width = Math.min(
    Math.max(0, preferredWidth),
    Math.max(0, viewport.width - horizontalGutter * 2),
  );
  const maxLeft = viewport.width - horizontalGutter - width;
  const left = clamp(anchor.left, horizontalGutter, maxLeft);
  const belowSpace = Math.max(
    0,
    viewport.height - verticalGutter - safeGap - anchor.bottom,
  );
  const aboveSpace = Math.max(
    0,
    anchor.top - verticalGutter - safeGap,
  );
  const safePreferredMaxHeight = Math.max(0, preferredMaxHeight);
  const desiredHeight = Math.min(
    Math.max(0, contentHeight),
    safePreferredMaxHeight,
  );
  const side =
    belowSpace >= desiredHeight || belowSpace >= aboveSpace ? "below" : "above";
  const availableHeight = side === "below" ? belowSpace : aboveSpace;
  const maxHeight = Math.min(safePreferredMaxHeight, availableHeight);
  const renderedHeight = Math.min(Math.max(0, contentHeight), maxHeight);
  const top =
    side === "below"
      ? anchor.bottom + safeGap
      : anchor.top - safeGap - renderedHeight;

  return { side, top, left, width, maxHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
