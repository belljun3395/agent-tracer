import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "users" })
export class UserEntity {
    @PrimaryColumn({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    email!: string;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;
}
