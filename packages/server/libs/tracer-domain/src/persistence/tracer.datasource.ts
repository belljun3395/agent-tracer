import "reflect-metadata";
import { createDataSource, loadApplicationConfig } from "@monitor/platform";
import { TRACER_MIGRATIONS } from "../migrations/registry.js";
import { TRACER_ENTITIES } from "./tracer.entities.js";

// 마이그레이션 CLI 전용 DataSource이며 tracer DB 설정으로 전체 엔티티와 마이그레이션을 등록한다.
const tracerDataSource = createDataSource({
    db: loadApplicationConfig().tracerDb,
    entities: TRACER_ENTITIES,
    migrations: [...TRACER_MIGRATIONS],
});

export default tracerDataSource;
