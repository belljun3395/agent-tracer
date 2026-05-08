import { useRef, type CSSProperties, type PointerEvent } from "react";

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
 */
export function ResizeHandle({ side, currentWidth, onResize }: ResizeHandleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    startWidthRef.current = currentWidth;
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
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const positionStyle: CSSProperties =
    side === "right"
      ? { right: -3, top: 0, bottom: 0, width: 6 }
      : { left: -3, top: 0, bottom: 0, width: 6 };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute z-10 cursor-col-resize hover:bg-[var(--primary)]/40 transition-colors"
      style={{
        ...positionStyle,
        background: "transparent",
      }}
    />
  );
}
