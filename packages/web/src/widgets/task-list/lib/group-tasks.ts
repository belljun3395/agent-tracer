export type TaskGroupKey = "live" | "today" | "yesterday" | "older";

/** 사이드바 그룹의 고정 노출 순서와 라벨. */
export const TASK_GROUP_ORDER: readonly { readonly key: TaskGroupKey; readonly label: string }[] = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "older", label: "Older" },
];

/** 한 시각(ms)이 오늘/어제/그 이전 중 어디에 속하는지 판정한다. */
export function timeBucketKey(ms: number, nowMs: number): Exclude<TaskGroupKey, "live"> {
  const startOfToday = startOfDay(nowMs);
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  if (ms >= startOfToday) return "today";
  if (ms >= startOfYesterday) return "yesterday";
  return "older";
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
