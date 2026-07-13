import type { ReactNode } from "react";

export function EmptyHint({ children }: { readonly children: ReactNode }) {
  return (
    <div className="py-8 text-center text-[12.5px] text-ink-muted">{children}</div>
  );
}
