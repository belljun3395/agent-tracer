import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 원장 PK에 파티션 키가 섞여 있어 이벤트 ID 단독 멱등성은 이 테이블이 소유한다. */
@Entity({ name: "event_ingest_keys" })
@Index("event_ingest_keys_first_seen_at_idx", ["firstSeenAt"])
export class EventIngestKeyEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "first_seen_at", type: "timestamptz", insert: false, default: () => "now()" })
    firstSeenAt!: Date;
}
