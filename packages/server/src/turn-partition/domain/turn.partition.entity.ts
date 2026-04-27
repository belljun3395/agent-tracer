import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "turn_partitions_current" })
export class TurnPartitionEntity {
    @PrimaryColumn({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "groups_json", type: "text" })
    groupsJson!: string;

    @Column({ type: "integer", default: 1 })
    version!: number;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;
}
