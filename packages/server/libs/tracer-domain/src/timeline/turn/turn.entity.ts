import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { TURN_STATUS, type TurnStatus } from "./turn.const.js";

@Entity({ name: "turns" })
@Index("turns_task", ["taskId", "turnIndex"])
@Index("turns_session_index", ["sessionId", "turnIndex"], { unique: true })
export class TurnEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "session_id", type: "text" })
    sessionId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "turn_index", type: "integer" })
    turnIndex!: number;

    @Column({ type: "text" })
    status!: TurnStatus;

    @Column({ name: "started_at", type: "timestamptz" })
    startedAt!: Date;

    @Column({ name: "ended_at", type: "timestamptz", nullable: true })
    endedAt!: Date | null;

    @Column({ name: "asked_text", type: "text", nullable: true })
    askedText!: string | null;

    @Column({ name: "assistant_text", type: "text", nullable: true })
    assistantText!: string | null;

    @Column({ name: "aggregate_verdict", type: "text", nullable: true })
    aggregateVerdict!: string | null;

    @Column({ name: "rules_evaluated_count", type: "integer", default: 0 })
    rulesEvaluatedCount!: number;

    static open(sessionId: string, taskId: string, index: number, askedText: string, at: Date): TurnEntity {
        const turn = new TurnEntity();
        turn.id = `${sessionId}#${String(index).padStart(4, "0")}`;
        turn.sessionId = sessionId;
        turn.taskId = taskId;
        turn.turnIndex = index;
        turn.status = TURN_STATUS.open;
        turn.startedAt = at;
        turn.endedAt = null;
        turn.askedText = askedText;
        turn.assistantText = null;
        turn.aggregateVerdict = null;
        turn.rulesEvaluatedCount = 0;
        return turn;
    }

    close(assistantText: string, at: Date): void {
        // 이미 닫힌 턴은 다시 닫지 않는다.
        if (this.status === TURN_STATUS.closed) return;
        this.status = TURN_STATUS.closed;
        this.endedAt = at;
        this.assistantText = assistantText;
    }

    // 응답을 받지 못한 채 다음 턴이 시작돼 닫힌다.
    endWithoutResponse(at: Date): void {
        if (this.status === TURN_STATUS.closed) return;
        this.status = TURN_STATUS.closed;
        this.endedAt = at;
    }

    isOpen(): boolean {
        return this.status === TURN_STATUS.open;
    }

    // 턴을 붙잡을 수 있는 규칙이 하나도 없으면 이 턴을 대표할 상태가 없다.
    recordVerdictSummary(aggregate: string | null, evaluatedCount: number): void {
        this.aggregateVerdict = aggregate;
        this.rulesEvaluatedCount = evaluatedCount;
    }
}
