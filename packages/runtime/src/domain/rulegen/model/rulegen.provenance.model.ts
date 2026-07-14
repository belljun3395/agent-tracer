import type {EventEvidence, TurnDigest} from "~runtime/domain/rulegen/model/evidence.model.js";

/** 이 실행에서 모델이 인용해도 되는 식별자의 전부다. */
export interface RulegenProvenanceSnapshot {
    readonly turnIds: readonly string[];
    readonly eventIds: readonly string[];
}

/** 도구가 모델에게 실제로 돌려준 응답만 먹는 근거 장부이며 수명은 실행 하나다. */
export class RulegenProvenanceLedger {
    private readonly turnIds = new Set<string>();
    private readonly eventIds = new Set<string>();

    recordTurns(turns: readonly TurnDigest[]): void {
        for (const turn of turns) this.turnIds.add(turn.turnId);
    }

    /** 이벤트 응답에 실린 turnId도 모델이 본 것이므로 인용을 허가한다. */
    recordEvents(events: readonly EventEvidence[]): void {
        for (const event of events) {
            this.eventIds.add(event.eventId);
            if (event.turnId !== undefined) this.turnIds.add(event.turnId);
        }
    }

    snapshot(): RulegenProvenanceSnapshot {
        return {turnIds: [...this.turnIds], eventIds: [...this.eventIds]};
    }
}

export function isTurnGrounded(snapshot: RulegenProvenanceSnapshot, turnId: string): boolean {
    return snapshot.turnIds.includes(turnId);
}

export function isEventGrounded(snapshot: RulegenProvenanceSnapshot, eventId: string): boolean {
    return snapshot.eventIds.includes(eventId);
}
