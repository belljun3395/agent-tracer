import { Column, Entity, PrimaryColumn } from "typeorm";

/** 온보딩 시 기록되는 사용자. userId 는 이메일에서 결정적으로 유도된다. */
@Entity({ name: "users" })
export class UserEntity {
    @PrimaryColumn({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    email!: string;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;
}
