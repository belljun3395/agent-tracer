import { useEffect, type ReactNode } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";

interface DrawerProps {
  readonly side: "left" | "right";
  readonly width: number;
  readonly label: string;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}

/** 좁은 뷰포트의 보조 패널을 배경과 Escape로 닫히는 시트로 표시한다. */
export function Drawer({ side, width, label, onDismiss, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-auto" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss drawer"
        className="absolute inset-0 bg-canvas/60 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "relative min-h-0 overflow-hidden flex flex-col bg-canvas",
          side === "right"
            ? "ml-auto border-l border-hair shadow-[-4px_0_24px_rgba(0,0,0,0.25)]"
            : "border-r border-hair shadow-[4px_0_24px_rgba(0,0,0,0.25)]",
        )}
        style={{ width, maxWidth: "100vw" }}
      >
        {children}
      </div>
    </div>
  );
}
