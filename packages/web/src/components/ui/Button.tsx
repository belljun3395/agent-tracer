import { forwardRef } from "react";
import type React from "react";

import { cn } from "../../lib/ui/cn.js";

type ButtonVariant = "ghost" | "bare" | "destructive";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

const buttonVariants: Record<ButtonVariant, string> = {
  ghost: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]",
  bare: "border border-transparent bg-transparent text-inherit shadow-none hover:bg-transparent",
  destructive: "border border-transparent bg-[var(--err-bg)] text-[var(--err)] shadow-none hover:bg-[#fef2f2] hover:text-[var(--err)]"
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.82rem]",
  md: "h-9 px-4 text-sm",
  icon: "h-8 w-8 p-0 text-sm"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    type = "button",
    variant = "ghost",
    size = "md",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-[7px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
});
