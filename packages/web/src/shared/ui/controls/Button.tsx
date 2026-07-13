import type { ComponentPropsWithoutRef } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

type ButtonVariant = "primary" | "solid" | "ghost";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  readonly variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary border border-primary",
  solid: "bg-ink text-canvas border border-hair",
  ghost: "bg-transparent text-ink-muted border border-hair",
};

export function Button({ variant = "ghost", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "px-3 py-1.5 text-[12.5px] font-medium rounded-xs transition-opacity",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        variantClass[variant],
        className,
      )}
      {...rest}
    />
  );
}
