import type React from "react";
import { cn } from "~app/lib/ui/cn.js";

type EyebrowProps = React.ComponentPropsWithoutRef<"span">;

export function Eyebrow({ className, ...props }: EyebrowProps): React.JSX.Element {
    return <span className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]", className)} {...props}/>;
}
