export const DEFAULT_RULEGEN_DEADLINE_MS = 720_000;

/** 데드라인과 취소 신호를 하나의 중단 신호로 합친 것이다. */
export interface RuleGenerationDeadline {
    readonly controller: AbortController;
    readonly dispose: () => void;
}

export function createDeadline(deadlineMs: number, cancelSignal?: AbortSignal): RuleGenerationDeadline {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new Error(`rule generation exceeded ${deadlineMs}ms deadline`));
    }, deadlineMs);
    timer.unref();

    const onCancel = (): void => controller.abort(new Error("rule generation canceled"));
    if (cancelSignal?.aborted === true) onCancel();
    else cancelSignal?.addEventListener("abort", onCancel, {once: true});

    return {
        controller,
        dispose: () => {
            clearTimeout(timer);
            cancelSignal?.removeEventListener("abort", onCancel);
        },
    };
}
