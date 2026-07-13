import { useEffect } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useTaskList } from "~web/widgets/task-list/hooks/useTaskList.js";
import {
  useSelectedTaskId,
  useSetShortcutsOpen,
  useShortcutsOpen,
} from "~web/shared/store/index.js";

/** 대시보드 셸의 전역 탐색과 단축키 오버레이 키 입력을 연결한다. */
export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();
  const selectedTaskId = useSelectedTaskId();
  const { groups } = useTaskList();
  const shortcutsOpen = useShortcutsOpen();
  const setShortcutsOpen = useSetShortcutsOpen();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const isComposing = isEditableTarget(target);

      if (event.key === "/" && !isComposing) {
        event.preventDefault();
        focusSidebarSearch();
        return;
      }

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
          void navigate("/rules");
          return;
        case "?":
          event.preventDefault();
          setShortcutsOpen(!shortcutsOpen);
          return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, selectedTaskId, groups, shortcutsOpen, setShortcutsOpen]);
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
  navigate: NavigateFunction,
): void {
  const flat: readonly TaskRowVm[] = groups.flatMap((group) => group.rows);
  if (flat.length === 0) return;

  let index = flat.findIndex((row) => row.task.id === selectedTaskId);
  if (index === -1) {
    index = direction === 1 ? 0 : flat.length - 1;
  } else {
    index += direction;
    if (index < 0) index = flat.length - 1;
    if (index >= flat.length) index = 0;
  }

  const next = flat[index];
  if (next) void navigate(`/tasks/${next.task.id}`);
}

function focusSidebarSearch(): void {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Search tasks"]',
  );
  input?.focus();
  input?.select();
}

function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT";
}
