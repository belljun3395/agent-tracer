import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  /** Constrains the panel width — defaults to a comfortable form size. */
  readonly maxWidth?: number;
}

/**
 * Lightweight modal that renders into document.body. Locks page scroll,
 * closes on Escape and backdrop click, and focuses the first focusable
 * element in the panel on open.
 *
 * Intentionally minimal — when we need a second modal anywhere in the
 * app, swap this for `@radix-ui/react-dialog` (focus trap + a11y plus).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 520,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "color-mix(in srgb, var(--canvas) 70%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "10vh 16px 16px",
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: "100%",
          maxWidth,
          background: "var(--s1)",
          border: "1px solid var(--hair)",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.6)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid var(--hair)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              letterSpacing: "-0.1px",
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--ink-subtle)",
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </header>
        <div style={{ overflow: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
