import { Column, Entity, PrimaryColumn } from "typeorm";
import type { FileAffinityRole } from "./file.affinity.const.js";

@Entity({ name: "file_affinity_summary" })
export class FileAffinityEntity {
    @PrimaryColumn({ name: "file_path", type: "text" })
    filePath!: string;

    @PrimaryColumn({ name: "intent_label", type: "text" })
    intentLabel!: string;

    @PrimaryColumn({ type: "text" })
    role!: FileAffinityRole;

    @Column({ name: "open_count", type: "integer", default: 0 })
    openCount!: number;

    @Column({ name: "last_seen_at", type: "timestamptz" })
    lastSeenAt!: Date;
}
