import { useToastStore, type Toast } from "./toastStore.js";

/**
 * Bottom-right toast region. Stacks up to a handful of recent
 * notifications; the store auto-dismisses each after a few seconds
 * (or on user click).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: "fixed",
        right: 16,
        // Sit just under the 48px TopBar so the toast never overlaps the
        // brand/breadcrumbs row.
        top: 56,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 60,
        pointerEvents: "none",
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const accent =
    toast.tone === "error"
      ? "var(--err)"
      : toast.tone === "success"
        ? "var(--ok)"
        : "var(--primary)";
  return (
    <div
      role="status"
      style={{
        pointerEvents: "auto",
        background: "var(--canvas)",
        border: `1px solid var(--hair)`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--elev-1)",
        padding: "10px 12px",
        minWidth: 240,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 12.5,
            color: "var(--ink)",
            letterSpacing: "-0.05px",
          }}
        >
          {toast.title}
        </div>
        {toast.body && (
          <div
            style={{
              marginTop: 2,
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "var(--ink-subtle)",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {toast.body}
          </div>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick();
              onDismiss();
            }}
            style={{
              marginTop: 8,
              padding: "4px 8px",
              fontFamily: "var(--font-sans)",
              fontSize: 11.5,
              fontWeight: 600,
              color: accent,
              background: "transparent",
              border: `1px solid ${accent}`,
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              letterSpacing: "-0.05px",
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "transparent",
          border: 0,
          color: "var(--ink-tertiary)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ×
      </button>
    </div>
  );
}
