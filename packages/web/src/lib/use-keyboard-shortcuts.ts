import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelectedTaskId } from "~state/ui/index.js";
import { useTaskList } from "~features/task-list/hooks/useTaskList.js";

/**
 * Global keyboard shortcuts for the operator dashboard.
 *
 *   /       — focus the sidebar search input
 *   j / k   — move selection to the next / previous task in the
 *             grouped sidebar order (skips collapsed children)
 *   g       — go to the global rules page
 *   ?       — toggle the help overlay (TODO — currently logs to console)
 *   Esc     — clear an active search input (if focused) or blur it
 *
 * The hook is registered once at the shell level. To avoid hijacking
 * keypresses while the user is composing text, every shortcut is
 * suppressed when the focused element is an input, textarea, or
 * contenteditable region (with `/` and `Esc` as deliberate exceptions
 * so a user typing in the search bar can still hit `Esc` to clear).
 */
export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();
  const selectedTaskId = useSelectedTaskId();
  const { groups } = useTaskList();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Allow Ctrl/Cmd/Alt combinations to fall through — they're
      // typically OS-level shortcuts (Cmd+F, etc.) and we don't want
      // to shadow them.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const isComposing = isEditableTarget(target);

      // `/` is the universal "focus search" — works even when the user
      // is typing somewhere else, so we shortcut past the editability
      // guard for this single key.
      if (event.key === "/" && !isComposing) {
        event.preventDefault();
        focusSidebarSearch();
        return;
      }

      // `Esc` while inside the search input clears + blurs it. While
      // composing in any other field we let the native behaviour win.
      if (event.key === "Escape") {
        if (target instanceof HTMLInputElement && target.getAttribute("aria-label") === "Search tasks") {
          event.preventDefault();
          target.value = "";
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.blur();
        }
        return;
      }

      if (isComposing) return;

      switch (event.key) {
        case "j":
          event.preventDefault();
          moveSelection(groups, selectedTaskId, +1, navigate);
          return;
        case "k":
          event.preventDefault();
          moveSelection(groups, selectedTaskId, -1, navigate);
          return;
        case "g":
          event.preventDefault();
          navigate("/rules");
          return;
        case "?":
          event.preventDefault();
          // eslint-disable-next-line no-console
          console.info(
            "agent-tracer shortcuts: / search · j next · k prev · g rules · Esc clear",
          );
          return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, selectedTaskId, groups]);
}

interface TaskRowVm {
  readonly task: { readonly id: string };
}
interface TaskGroupVm {
  readonly rows: readonly TaskRowVm[];
}

function moveSelection(
  groups: readonly TaskGroupVm[],
  selectedTaskId: string | null,
  direction: 1 | -1,
  navigate: (path: string) => void,
): void {
  const flat: readonly TaskRowVm[] = groups.flatMap((g) => g.rows);
  if (flat.length === 0) return;
  let idx = flat.findIndex((r) => r.task.id === selectedTaskId);
  if (idx === -1) {
    // No current selection — j goes to first, k goes to last.
    idx = direction === 1 ? 0 : flat.length - 1;
  } else {
    idx = idx + direction;
    if (idx < 0) idx = flat.length - 1;
    if (idx >= flat.length) idx = 0;
  }
  const next = flat[idx];
  if (next) navigate(`/tasks/${next.task.id}`);
}

function focusSidebarSearch(): void {
  // Look up by aria-label — the input lives inside TaskListHeader and
  // doesn't have a stable id. There's only one at a time.
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Search tasks"]',
  );
  input?.focus();
  input?.select();
}

function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
