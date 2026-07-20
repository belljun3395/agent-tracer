/** 태스크가 처음 열린 첫 발화 시점만 겨누는 넛지다. */
export function formatTitleNudge(): string {
    return [
        "<agent-tracer-task-title>",
        "This task just opened with a crude placeholder title.",
        "If the work ahead is already scoped and worth tracking on its own, call `set_task_title` now.",
        "If this is a trivial or one-off question, skip it — that judgment call is yours.",
        "</agent-tracer-task-title>",
    ].join("\n");
}
