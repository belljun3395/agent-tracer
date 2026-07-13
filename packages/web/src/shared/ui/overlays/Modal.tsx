import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  GuidanceLocale,
  GuidanceMessage,
} from "~web/shared/guidance.js";
import { GuidanceText } from "~web/shared/GuidanceText.js";

interface ModalPropsBase {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  /** 패널 너비를 제한한다. */
  readonly maxWidth?: number;
}

type ModalProps = ModalPropsBase &
  (
    | {
        readonly description: GuidanceMessage;
        readonly descriptionLocale: GuidanceLocale;
      }
    | {
        readonly description?: never;
        readonly descriptionLocale?: never;
      }
  );

/** document.body에 렌더링되는 가벼운 모달. */
export function Modal({
  open,
  onClose,
  title,
  description,
  descriptionLocale,
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
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-canvas/70 backdrop-blur-[4px] px-4 pt-[10vh] pb-4"
    >
      <div
        ref={panelRef}
        style={{ maxWidth }}
        className="w-full bg-s1 border border-hair rounded-md shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)] max-h-[80vh] flex flex-col overflow-hidden"
      >
        <header className="px-4 pt-3.5 pb-3 border-b border-hair">
          <h2 className="m-0 text-sm font-semibold text-ink tracking-[-0.1px]">
            {title}
          </h2>
          {description && (
            <GuidanceText
              as="p"
              className="mt-1 mb-0 text-xs text-ink-subtle leading-[1.5]"
              locale={descriptionLocale}
              message={description}
            />
          )}
        </header>
        <div className="overflow-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
