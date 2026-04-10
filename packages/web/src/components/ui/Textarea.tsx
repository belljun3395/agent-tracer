import { forwardRef } from "react";
import type React from "react";
import { cn } from "../../lib/ui/cn.js";

type TextareaProps = React.ComponentPropsWithoutRef<"textarea">;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn("rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.84rem] leading-6 text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]", className)} {...props}/>;
});
