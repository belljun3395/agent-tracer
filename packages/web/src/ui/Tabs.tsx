import * as RxTabs from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const Tabs = RxTabs.Root;

export const TabsList = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RxTabs.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <RxTabs.List
      ref={ref}
      className={cn(
        "flex border-b border-[var(--hair)] px-3.5",
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RxTabs.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <RxTabs.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-3 -mb-px",
        "text-[12.5px] font-medium text-[var(--ink-subtle)]",
        "border-b-2 border-transparent",
        "hover:text-[var(--ink)]",
        "data-[state=active]:text-[var(--ink)] data-[state=active]:border-[var(--primary)]",
        "disabled:opacity-40 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_45%,transparent)]",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RxTabs.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <RxTabs.Content ref={ref} className={cn("flex-1", className)} {...props} />;
});
