import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "~web/app/layout/useKeyboardShortcuts.js";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setShortcutsOpen: vi.fn(),
  selectedTaskId: null as string | null,
  shortcutsOpen: false,
  groups: [
    { rows: [{ task: { id: "a" } }, { task: { id: "b" } }] },
    { rows: [{ task: { id: "c" } }] },
  ],
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("~web/shared/store/index.js", () => ({
  useSelectedTaskId: () => mocks.selectedTaskId,
  useSetShortcutsOpen: () => mocks.setShortcutsOpen,
  useShortcutsOpen: () => mocks.shortcutsOpen,
}));

vi.mock("~web/widgets/task-list/hooks/useTaskList.js", () => ({
  useTaskList: () => ({ groups: mocks.groups }),
}));

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.setShortcutsOpen.mockReset();
    mocks.selectedTaskId = null;
    mocks.shortcutsOpen = false;
    document.body.replaceChildren();
  });

  it("입력 요소에서 전역 단축키를 가로채지 않는다", () => {
    renderHook(() => useKeyboardShortcuts());
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(input, { key: "j" });
    fireEvent.keyDown(input, { key: "g" });
    fireEvent.keyDown(input, { key: "?" });

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.setShortcutsOpen).not.toHaveBeenCalled();
  });

  it("물음표 키로 단축키 오버레이를 토글한다", () => {
    mocks.shortcutsOpen = true;
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(window, { key: "?" });

    expect(mocks.setShortcutsOpen).toHaveBeenCalledWith(false);
  });

  it.each([
    ["c", "j", "/tasks/a"],
    ["a", "k", "/tasks/c"],
    [null, "j", "/tasks/a"],
    [null, "k", "/tasks/c"],
  ] as const)("선택 %s에서 %s 키로 %s로 순환한다", (selected, key, expected) => {
    mocks.selectedTaskId = selected;
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(window, { key });

    expect(mocks.navigate).toHaveBeenCalledWith(expected);
  });

  it("슬래시 키로 태스크 검색 입력에 포커스한다", () => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Search tasks");
    input.value = "query";
    document.body.append(input);
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("검색 입력의 Escape 키는 값을 지우고 포커스를 해제한다", () => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Search tasks");
    input.value = "query";
    document.body.append(input);
    input.focus();
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("");
    expect(document.activeElement).not.toBe(input);
  });

  it("g 키로 전역 규칙 화면으로 이동한다", () => {
    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(window, { key: "g" });

    expect(mocks.navigate).toHaveBeenCalledWith("/rules");
  });
});
