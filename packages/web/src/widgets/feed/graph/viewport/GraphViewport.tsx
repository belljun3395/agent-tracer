import type { ReactNode } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";
import type { GraphViewportBinding } from "~web/widgets/feed/graph/viewport/use-graph-viewport.js";

interface GraphViewportProps {
  readonly binding: GraphViewportBinding;
  readonly children: ReactNode;
}

/** 확대된 그래프 콘텐츠에 가로 스크롤과 포인터 팬 표면을 제공한다. */
export function GraphViewport({ binding, children }: GraphViewportProps) {
  return (
    <div
      ref={binding.scrollRef}
      role="region"
      aria-label="Graph viewport"
      onWheel={binding.onWheel}
      onPointerDown={binding.onPointerDown}
      onPointerMove={binding.onPointerMove}
      onPointerUp={binding.onPointerUp}
      onPointerCancel={binding.onPointerUp}
      className={cn(
        "overflow-x-auto overflow-y-hidden relative",
        binding.dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <div
        className="min-w-full relative"
        style={{ width: `${binding.zoom * 100}%` }}
      >
        {children}
      </div>
    </div>
  );
}
