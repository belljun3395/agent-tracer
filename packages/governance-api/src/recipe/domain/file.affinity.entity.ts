import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type FileAffinityRole = "read" | "write" | "both";

@Entity({ name: "file_affinity_summary" })
@Index("idx_file_affinity_intent", ["intentLabel", "openCount"])
@Index("idx_file_affinity_path", ["filePath"])
export class FileAffinityEntity {
    @PrimaryColumn({ name: "file_path", type: "text" })
    filePath!: string;

    @PrimaryColumn({ name: "intent_label", type: "text" })
    intentLabel!: string;

    @PrimaryColumn({ type: "text" })
    role!: FileAffinityRole;

    @Column({ name: "open_count", type: "integer", default: 0 })
    openCount!: number;

    @Column({ name: "last_seen_at", type: "text" })
    lastSeenAt!: string;
}
