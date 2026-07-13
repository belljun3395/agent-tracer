import { Column, Entity, PrimaryColumn } from "typeorm";
import { isLlmKeySettingKey } from "./settings.const.js";

@Entity({ name: "app_settings" })
export class AppSettingEntity {
    @PrimaryColumn({ type: "text" })
    key!: string;

    @Column({ type: "text" })
    value!: string;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    isLlmKey(): boolean {
        return isLlmKeySettingKey(this.key);
    }

    hasValue(): boolean {
        return this.value.length > 0;
    }
}
