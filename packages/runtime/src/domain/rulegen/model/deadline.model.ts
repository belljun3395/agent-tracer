export const DEFAULT_RULEGEN_DEADLINE_MS = 720_000;

/** 잡이 취소됐거나 리스를 잃었거나 데몬이 내려가 실행을 끊은 것이며 그 잡은 더 이상 이 데몬의 것이 아니다. */
export class RulegenCanceled extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RulegenCanceled";
    }
}

/** 실행이 제한 시간을 넘겨 끊긴 것이며 잡은 여전히 이 데몬의 것이므로 실패로 종결해야 한다. */
export class RulegenDeadlineExceeded extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RulegenDeadlineExceeded";
    }
}

export function isRulegenCanceled(reason: unknown): boolean {
    return reason instanceof RulegenCanceled;
}

/** 데드라인과 취소 신호를 하나의 중단 신호로 합친 것이다. */
export interface RuleGenerationDeadline {
    readonly controller: AbortController;
    readonly dispose: () => void;
}

export function createDeadline(deadlineMs: number, cancelSignal?: AbortSignal): RuleGenerationDeadline {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new RulegenDeadlineExceeded(`rule generation exceeded ${deadlineMs}ms deadline`));
    }, deadlineMs);
    timer.unref();

    const onCancel = (): void => controller.abort(new RulegenCanceled("rule generation canceled"));
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
