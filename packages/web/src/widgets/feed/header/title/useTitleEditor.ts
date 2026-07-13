import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { useUpdateTaskMutation } from "~web/entities/task/api/edit-mutations.js";

/** 인라인 제목 편집의 초점과 임시 값 및 저장 생명주기를 소유한다. */
export function useTitleEditor(task: MonitoringTask) {
  const mutation = useUpdateTaskMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const current = task.displayTitle ?? task.title;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    setDraft(current);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === current) {
      setEditing(false);
      return;
    }
    mutation.mutate(
      { taskId: task.id, body: { title: trimmed } },
      { onSettled: () => setEditing(false) },
    );
  };

  const cancel = () => {
    setEditing(false);
    setDraft(current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return {
    editing,
    draft,
    current,
    inputRef,
    isPending: mutation.isPending,
    setDraft,
    start,
    commit,
    onKeyDown,
  } as const;
}
