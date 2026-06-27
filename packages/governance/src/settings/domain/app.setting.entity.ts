import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "app_settings" })
export class AppSettingEntity {
    @PrimaryColumn({ type: "text" })
    key!: string;

    @Column({ type: "text" })
    value!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;
}
