import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type { TimelineItemLayout } from "~app/lib/timeline.js";
import { areNodeBoundsEqual, type NodeBounds } from "./layout.js";

/**
 * Measures DOM bounding boxes for each timeline event node relative to the
 * canvas container. Re-measures on layout changes and window resize.
 */
export function useNodeBounds(
    canvasRef: React.RefObject<HTMLDivElement | null>,
    items: readonly TimelineItemLayout[],
): {
    nodeBounds: Record<string, NodeBounds>;
    nodeRefs: React.RefObject<Map<string, HTMLElement>>;
} {
    const [nodeBounds, setNodeBounds] = useState<Record<string, NodeBounds>>({});
    const nodeRefs = useRef(new Map<string, HTMLElement>());

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            setNodeBounds({});
            return;
        }
        function measureNodes(): void {
            const canvasRect = canvas!.getBoundingClientRect();
            const nextBounds: Record<string, NodeBounds> = {};
            for (const item of items) {
                const node = nodeRefs.current.get(item.event.id);
                if (!node) continue;
                const rect = node.getBoundingClientRect();
                nextBounds[item.event.id] = {
                    left: rect.left - canvasRect.left,
                    top: rect.top - canvasRect.top,
                    width: rect.width,
                    height: rect.height,
                };
            }
            setNodeBounds((current) =>
                areNodeBoundsEqual(current, nextBounds) ? current : nextBounds,
            );
        }
        measureNodes();
        const frame = requestAnimationFrame(measureNodes);
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(() => measureNodes());
        observer?.observe(canvas);
        for (const item of items) {
            const node = nodeRefs.current.get(item.event.id);
            if (node) observer?.observe(node);
        }
        window.addEventListener("resize", measureNodes);
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener("resize", measureNodes);
        };
    }, [canvasRef, items]);

    return { nodeBounds, nodeRefs };
}
