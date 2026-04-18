import { forwardRef } from "react";
import type React from "react";
import { cn } from "../../lib/ui/cn.js";
type ButtonVariant = "ghost" | "bare" | "destructive" | "accent";
type ButtonSize = "sm" | "md" | "icon";
interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
    readonly variant?: ButtonVariant;
    readonly size?: ButtonSize;
}
const buttonVariants: Record<ButtonVariant, string> = {
    ghost: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-[var(--shadow-1)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]",
    bare: "border border-transparent bg-transparent text-inherit shadow-none hover:bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text-1)]",
    destructive: "border border-[color-mix(in_srgb,var(--err)_16%,var(--border))] bg-[var(--err-bg)] text-[var(--err)] shadow-[var(--shadow-1)] hover:border-[color-mix(in_srgb,var(--err)_28%,var(--border))] hover:bg-[color-mix(in_srgb,var(--err-bg)_88%,white)] hover:text-[var(--err)]",
    accent: "border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[var(--accent-light)] text-[var(--accent)] shadow-[var(--shadow-1)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--accent-light))] hover:text-[var(--accent)]"
};
const buttonSizes: Record<ButtonSize, string> = {
    sm: "h-7 px-2.5 text-[0.76rem]",
    md: "h-8 px-3.5 text-[0.84rem]",
    icon: "h-7 w-7 p-0 text-[0.82rem]"
};
const buttonBase = "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50";
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, type = "button", variant = "ghost", size = "md", ...props }, ref) {
    return (<button ref={ref} type={type} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props}/>);
});
