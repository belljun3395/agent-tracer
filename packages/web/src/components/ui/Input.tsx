import { forwardRef } from "react";
import type React from "react";
import { cn } from "../../lib/ui/cn.js";

type InputProps = React.ComponentPropsWithoutRef<"input">;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]", className)} {...props}/>;
});
