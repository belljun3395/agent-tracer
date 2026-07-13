import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { centeredTrackScrollLeft } from "~web/widgets/feed/graph/viewport/geometry.js";
import {
  DEFAULT_GRAPH_ZOOM,
  clampGraphZoom,
} from "~web/widgets/feed/graph/model/zoom.js";

const WHEEL_SENSITIVITY = 0.0015;

interface UseGraphViewportOptions {
  readonly itemCount: number;
  readonly latestLeftPercent: number | null;
  readonly selectedKey: string | null;
  readonly selectedLeftPercent: number | null;
}

export interface GraphViewportBinding {
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly zoom: number;
  readonly dragging: boolean;
  readonly onWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** 그래프 viewport의 확대·팬·노드 포커스 생명주기를 소유한다. */
export function useGraphViewport({
  itemCount,
  latestLeftPercent,
  selectedKey,
  selectedLeftPercent,
}: UseGraphViewportOptions): {
  readonly binding: GraphViewportBinding;
  readonly setZoom: (zoom: number) => void;
} {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(DEFAULT_GRAPH_ZOOM);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{
    readonly startX: number;
    readonly startScrollLeft: number;
  } | null>(null);
  const lastItemCountRef = useRef(0);
  const latestLeftPercentRef = useRef<number | null>(latestLeftPercent);
  const selectedLeftPercentRef = useRef<number | null>(selectedLeftPercent);
  latestLeftPercentRef.current = latestLeftPercent;
  selectedLeftPercentRef.current = selectedLeftPercent;

  const focusOnPosition = useCallback((leftPercent: number) => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    requestAnimationFrame(() => {
      const inner = viewport.firstElementChild as HTMLElement | null;
      const innerWidth = inner?.scrollWidth ?? viewport.scrollWidth;
      viewport.scrollLeft = centeredTrackScrollLeft(
        leftPercent,
        innerWidth,
        viewport.clientWidth,
      );
    });
  }, []);

  useEffect(() => {
    if (itemCount === 0 || itemCount === lastItemCountRef.current) return;
    lastItemCountRef.current = itemCount;
    if (latestLeftPercent !== null) focusOnPosition(latestLeftPercent);
  }, [itemCount, latestLeftPercent, focusOnPosition]);

  useEffect(() => {
    const leftPercent = latestLeftPercentRef.current;
    if (leftPercent !== null) focusOnPosition(leftPercent);
  }, [zoom, focusOnPosition]);

  useEffect(() => {
    if (!selectedKey) return;
    const leftPercent = selectedLeftPercentRef.current;
    if (leftPercent !== null) focusOnPosition(leftPercent);
  }, [selectedKey, focusOnPosition]);

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const viewport = scrollRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const cursorX = pointerX + viewport.scrollLeft;
    const nextZoom = clampGraphZoom(
      zoom * (1 - event.deltaY * WHEEL_SENSITIVITY),
    );
    if (nextZoom === zoom) return;
    setZoomState(nextZoom);
    const ratio = nextZoom / zoom;
    requestAnimationFrame(() => {
      viewport.scrollLeft = cursorX * ratio - pointerX;
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const viewport = scrollRef.current;
    if (!drag || !viewport) return;
    viewport.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = scrollRef.current;
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setDragging(false);
  };

  return {
    binding: {
      scrollRef,
      zoom,
      dragging,
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    setZoom: setZoomState,
  };
}
