/** 태스크가 처음 열린 첫 발화 시점만 겨누는 넛지이며, 부를지 말지의 판단 기준은 `set_task_title` 도구 설명이 소유한다. */
export function formatTitleNudge(): string {
    return [
        "<agent-tracer-task-title>",
        "This task just opened with a crude placeholder title.",
        "If the work ahead is already scoped and worth tracking on its own, call the `set_task_title` tool now, before doing anything else.",
        "If this is a trivial, throwaway, or one-off question, skip it — that judgment call is yours.",
        "</agent-tracer-task-title>",
    ].join("\n");
}
