import type React from "react";
import { useRef, useState } from "react";

interface DragState {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly scrollLeft: number;
    readonly scrollTop: number;
}

interface UseTimelineDragReturn {
    readonly isDragging: boolean;
    readonly dragHandlers: {
        readonly onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
        readonly onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
        readonly onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
        readonly onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
    };
}

/** Handles click-and-drag panning for the timeline scroll container. */
export function useTimelineDrag(): UseTimelineDragReturn {
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef<DragState | null>(null);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest(".event-node, .connector-hitbox, button, input, label, a")) return;
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
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
        const current = dragState.current;
        if (!current || current.pointerId !== e.pointerId) return;
        e.currentTarget.scrollLeft = current.scrollLeft - (e.clientX - current.startX);
        e.currentTarget.scrollTop = current.scrollTop - (e.clientY - current.startY);
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
        if (dragState.current?.pointerId !== e.pointerId) return;
        dragState.current = null;
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>): void => {
        if (dragState.current?.pointerId !== e.pointerId) return;
        dragState.current = null;
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return { isDragging, dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
