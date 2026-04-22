import { forwardRef } from "react";
import type React from "react";
import { cn } from "../../lib/ui/cn.js";
type PanelCardProps = React.ComponentPropsWithoutRef<"div">;
export const PanelCard = forwardRef<HTMLDivElement, PanelCardProps>(function PanelCard({ className, ...props }, ref) {
    return (<div ref={ref} className={cn("flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-none", className)} {...props}/>);
});
