import * as RxScroll from "@radix-ui/react-scroll-area";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type Ref,
  type UIEventHandler,
} from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

interface ScrollAreaProps extends ComponentPropsWithoutRef<
  typeof RxScroll.Root
> {
  readonly viewportRef?: Ref<HTMLDivElement>;
  readonly onViewportScroll?: UIEventHandler<HTMLDivElement>;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    { className, children, viewportRef, onViewportScroll, ...props },
    ref,
  ) {
    return (
      <RxScroll.Root
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <RxScroll.Viewport
          ref={viewportRef}
          className="h-full w-full"
          onScroll={onViewportScroll}
        >
          {children}
        </RxScroll.Viewport>
        <RxScroll.Scrollbar
          orientation="vertical"
          className="flex w-2 select-none touch-none p-[2px] transition-colors duration-150"
        >
          <RxScroll.Thumb className="relative flex-1 rounded-full bg-[var(--hair)] hover:bg-[var(--hair-strong)]" />
        </RxScroll.Scrollbar>
        <RxScroll.Corner />
      </RxScroll.Root>
    );
  },
);
