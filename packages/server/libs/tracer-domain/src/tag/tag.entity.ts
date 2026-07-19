import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export interface TagCreateInput {
    readonly id: string;
    readonly userId: string;
    readonly name: string;
    readonly color: string;
    readonly description: string | null;
    readonly now: Date;
}

export interface TagUpdateInput {
    readonly name?: string;
    readonly color?: string;
    readonly description?: string | null;
}

// 워크스페이스 안에서 이름이 라벨 역할을 하므로 살아 있는 태그끼리는 이름이 겹치지 않는다.
@Entity({ name: "tags" })
@Index("tags_user_name", ["userId", "name"], { unique: true, where: '"deleted_at" IS NULL' })
@Index("tags_live_user", ["userId"], { where: '"deleted_at" IS NULL' })
export class TagEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    name!: string;

    @Column({ type: "text" })
    color!: string;

    @Column({ type: "text", nullable: true })
    description!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null;

    static create(input: TagCreateInput): TagEntity {
        const tag = new TagEntity();
        tag.id = input.id;
        tag.userId = input.userId;
        tag.name = input.name;
        tag.color = input.color;
        tag.description = input.description;
        tag.createdAt = input.now;
        tag.updatedAt = input.now;
        tag.deletedAt = null;
        return tag;
    }

    applyUpdate(input: TagUpdateInput, now: Date): void {
        if (input.name !== undefined) this.name = input.name;
        if (input.color !== undefined) this.color = input.color;
        if (input.description !== undefined) this.description = input.description;
        this.updatedAt = now;
    }

    softDelete(now: Date): void {
        this.deletedAt = now;
        this.updatedAt = now;
    }

    isDeleted(): boolean {
        return this.deletedAt !== null;
    }
}
