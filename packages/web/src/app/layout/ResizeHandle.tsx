import { useRef, useState, type PointerEvent } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

interface ResizeHandleProps {
  /** 어느 패널의 어느 모서리를 제어하는지. */
  readonly side: "left" | "right";
  readonly currentWidth: number;
  readonly onResize: (next: number) => void;
}

/** 얇은 드래그 가능 열 구분선. */
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
      className={cn(
        "absolute z-10 top-0 bottom-0 w-1.5 bg-transparent cursor-col-resize",
        side === "right" ? "-right-[3px]" : "-left-[3px]",
      )}
    >
      {/* 6px 히트 영역 가운데에 놓이는 2px 시각적 스트라이프다. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors duration-[120ms]",
          dragging ? "bg-primary" : hover ? "bg-primary/55" : "bg-transparent",
        )}
      />
    </div>
  );
}
