import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "~web/shared/ui/lib/cn.js";
import {
  calculateAnchoredPopoverPlacement,
  type AnchoredPopoverPlacement,
} from "~web/shared/ui/overlays/anchored-popover-placement.js";

interface AnchoredPopoverProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  readonly preferredWidth?: number;
  readonly preferredMaxHeight?: number;
  readonly gutter?: number;
  readonly gap?: number;
}

export const AnchoredPopover = forwardRef<HTMLDivElement, AnchoredPopoverProps>(function AnchoredPopover({
  anchorRef,
  children,
  preferredWidth = 320,
  preferredMaxHeight = 400,
  gutter = 12,
  gap = 8,
  className,
  style,
  ...props
}: AnchoredPopoverProps, forwardedRef) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] =
    useState<AnchoredPopoverPlacement | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) {
      setPlacement(null);
      return;
    }

    const rect = anchor.getBoundingClientRect();
    setPlacement(
      calculateAnchoredPopoverPlacement({
        anchor: rect,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        preferredWidth,
        contentHeight: panel.scrollHeight,
        preferredMaxHeight,
        gutter,
        gap,
      }),
    );
  }, [anchorRef, gap, gutter, preferredMaxHeight, preferredWidth]);

  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [children, reposition]);

  if (typeof document === "undefined") return null;

  const initialGutter = Math.min(
    Math.max(0, gutter),
    Math.max(0, window.innerWidth / 2),
  );
  const initialWidth = Math.min(
    Math.max(0, preferredWidth),
    Math.max(0, window.innerWidth - initialGutter * 2),
  );
  const positionStyle: CSSProperties = placement
    ? {
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        visibility: "visible",
      }
    : {
        top: 0,
        left: 0,
        width: initialWidth,
        maxHeight: preferredMaxHeight,
        visibility: "hidden",
        pointerEvents: "none",
      };

  return createPortal(
    <div
      ref={setPanelRef}
      data-side={placement?.side}
      className={cn("fixed z-[1000] overflow-y-auto", className)}
      style={{ ...positionStyle, ...style }}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
});
