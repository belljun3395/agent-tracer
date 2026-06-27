import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "event_files" })
@Index("idx_event_files_path", ["filePath"])
@Index("idx_event_files_event", ["eventId"])
export class EventFileEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @PrimaryColumn({ name: "file_path", type: "text" })
    filePath!: string;

    @Column({ type: "text", default: "metadata" })
    source!: string;

    @Column({ name: "write_count", type: "integer", default: 0 })
    writeCount!: number;
}
