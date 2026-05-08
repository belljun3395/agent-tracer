import * as RxScroll from "@radix-ui/react-scroll-area";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const ScrollArea = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RxScroll.Root>
>(function ScrollArea({ className, children, ...props }, ref) {
  return (
    <RxScroll.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <RxScroll.Viewport className="h-full w-full">{children}</RxScroll.Viewport>
      <RxScroll.Scrollbar
        orientation="vertical"
        className="flex w-2 select-none touch-none p-[2px] transition-colors duration-150"
      >
        <RxScroll.Thumb className="relative flex-1 rounded-full bg-[var(--hair)] hover:bg-[var(--hair-strong)]" />
      </RxScroll.Scrollbar>
      <RxScroll.Corner />
    </RxScroll.Root>
  );
});
