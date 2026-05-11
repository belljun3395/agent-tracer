import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

interface ResizeHandleProps {
  /**
   * Which edge of which panel this handle controls.
   *   "right" : sidebar's right edge   — drag right grows sidebar
   *   "left"  : inspector's left edge  — drag left grows inspector
   */
  readonly side: "left" | "right";
  readonly currentWidth: number;
  readonly onResize: (next: number) => void;
}

/**
 * Thin draggable column divider. Sits absolutely on the panel's edge so
 * the cursor can hit it without consuming click-through area in the rail.
 *
 * Pointer events instead of mouse events so it works on touch devices and
 * captures the drag even when the cursor leaves the handle's box mid-drag.
 *
 * Affordance: the 6px hit area is visually invisible by default (no
 * cursor hint, no stripe), so the audit flagged it as un-discoverable.
 * We now show a faint inner stripe on hover and a stronger one while
 * actively dragging — the user sees the column edge "light up" the
 * moment they bring the cursor near.
 */
export function ResizeHandle({ side, currentWidth, onResize }: ResizeHandleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    startWidthRef.current = currentWidth;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const delta = event.clientX - startXRef.current;
    const next =
      side === "right"
        ? startWidthRef.current + delta
        : startWidthRef.current - delta;
    onResize(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const positionStyle: CSSProperties =
    side === "right"
      ? { right: -3, top: 0, bottom: 0, width: 6 }
      : { left: -3, top: 0, bottom: 0, width: 6 };

  // The 2 px inner stripe is what the eye actually sees — the 6 px box
  // around it just enlarges the hit target. Stripe is centered in the
  // box and fades to primary as hover → active.
  const stripeColor = dragging
    ? "var(--primary)"
    : hover
      ? "color-mix(in srgb, var(--primary) 55%, transparent)"
      : "transparent";

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize panel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="absolute z-10 cursor-col-resize"
      style={{
        ...positionStyle,
        background: "transparent",
      }}
    >
      {/* Visual stripe (centered in the 6px hit area) */}
      <span
        aria-hidden
        className="absolute top-0 bottom-0"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          width: dragging ? 2 : 2,
          background: stripeColor,
          transition: "background 120ms",
        }}
      />
    </div>
  );
}
