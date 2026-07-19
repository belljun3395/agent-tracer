import "reflect-metadata";
import { getMetadataArgsStorage } from "typeorm";
import { TRACER_ENTITIES } from "./tracer.entities.js";

// 엔티티 데코레이터에 적힌 실제 테이블명을 돌려주어 TypeORM 의존을 영속 계층 안에 가두며, 기반 테이블에서 파생되는 뷰는 분류 대상이 아니라 빠진다.
export function tracerTableNames(): string[] {
    const registered = new Set<unknown>(TRACER_ENTITIES);
    return getMetadataArgsStorage()
        .tables.filter((table) => registered.has(table.target) && table.type !== "view")
        .map((table) => table.name ?? "")
        .filter((name) => name !== "");
}
