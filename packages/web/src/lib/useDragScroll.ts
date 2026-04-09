import { useCallback, useRef, useState } from "react";
import type React from "react";
interface DragState {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly scrollLeft: number;
    readonly scrollTop: number;
}
export interface DragScrollHandlers {
    readonly onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    readonly onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    readonly onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    readonly onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
}
export interface UseDragScrollResult {
    readonly isDragging: boolean;
    readonly handlers: DragScrollHandlers;
}
interface UseDragScrollOptions {
    readonly axis?: "x" | "y" | "both";
    readonly ignoreSelector?: string;
}
const DEFAULT_IGNORE = "button, input, label, a, select, textarea, [role='button'], [role='tab']";
export function useDragScroll({ axis = "both", ignoreSelector = DEFAULT_IGNORE, }: UseDragScrollOptions = {}): UseDragScrollResult {
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef<DragState | null>(null);
    const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>): void => {
        if (e.button !== 0)
            return;
        const target = e.target as HTMLElement | null;
        if (ignoreSelector && target?.closest(ignoreSelector))
            return;
        dragState.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            scrollLeft: e.currentTarget.scrollLeft,
            scrollTop: e.currentTarget.scrollTop,
        };
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
    }, [ignoreSelector]);
    const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>): void => {
        const current = dragState.current;
        if (!current || current.pointerId !== e.pointerId)
            return;
        if (axis !== "y") {
            e.currentTarget.scrollLeft = current.scrollLeft - (e.clientX - current.startX);
        }
        if (axis !== "x") {
            e.currentTarget.scrollTop = current.scrollTop - (e.clientY - current.startY);
        }
    }, [axis]);
    const stopDrag = useCallback((e: React.PointerEvent<HTMLElement>): void => {
        if (dragState.current?.pointerId !== e.pointerId)
            return;
        dragState.current = null;
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);
    return {
        isDragging,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: stopDrag,
            onPointerCancel: stopDrag,
        },
    };
}
