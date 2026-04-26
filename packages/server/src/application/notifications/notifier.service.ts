import type { TurnVerdict } from "~domain/verification";
import type { INotificationConfigReader, IOsNotifier } from "./notifier.port";
import { makeSlidingWindowThrottle, type SlidingWindowThrottle } from "./throttle";

export interface NewVerdictsInput {
    readonly turnId: string;
    readonly turnIndex: number;
    readonly verdicts: ReadonlyArray<TurnVerdict>;
}

export interface NotifierServiceDeps {
    readonly os: IOsNotifier;
    readonly config: INotificationConfigReader;
    readonly nowMs?: () => number;
    readonly throttleWindowMs?: number;
    readonly throttle?: SlidingWindowThrottle;
}

export class NotifierService {
    private readonly nowMs: () => number;
    private readonly throttle: SlidingWindowThrottle;

    constructor(private readonly deps: NotifierServiceDeps) {
        this.nowMs = deps.nowMs ?? (() => Date.now());
        this.throttle = deps.throttle
            ?? makeSlidingWindowThrottle({ windowMs: deps.throttleWindowMs ?? 10_000 });
    }

    async handleNewVerdicts(input: NewVerdictsInput): Promise<void> {
        const contradictions = input.verdicts.filter((v) => v.status === "contradicted");
        if (contradictions.length === 0) return;
        if (!await this.notificationsEnabled()) return;

        const throttleResult = this.throttle.admit(this.nowMs());
        if (!throttleResult.admit) return;

        const first = contradictions[0];
        const phrase = first?.detail.matchedPhrase;
        const message = throttleResult.suppressedCount > 0
            ? `${throttleResult.suppressedCount + 1} turns contradicted - open dashboard`
            : `Turn ${input.turnIndex} contradicted${phrase ? `: "${phrase}"` : ""}`;

        await this.deps.os.notify({
            title: "Agent Tracer verification",
            message,
        });
    }

    private async notificationsEnabled(): Promise<boolean> {
        const value = await this.deps.config.get("notifications.os");
        return value !== false;
    }
}
