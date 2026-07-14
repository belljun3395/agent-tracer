// 읽기 모델의 투영을 원장에서 Debezium 슬롯과 커넥터까지 재생성해 통째로 다시 만들되
// tracer-domain이 소유한 화이트리스트 밖의 테이블은 절대 건드리지 않는다.
import { execFileSync } from "node:child_process";
import process from "node:process";

const CONNECTOR = "runtime-ledger";
const SLOT = "runtime_ledger";
const TOPIC = "ingest.events";
const CONSUMER_GROUPS = ["projector-db", "projector-search", "projector-otlp"];

function run(command, args) {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function compose(args) {
    return run("docker", ["compose", ...args]);
}

function psql(service, database, sql) {
    return compose(["exec", "-T", service, "psql", "-U", "monitor", "-d", database, "-tAc", sql]);
}

function connectApi(method, path, body) {
    const args = ["exec", "-T", "connect", "curl", "-sf", "-X", method, `http://localhost:8083${path}`];
    if (body !== undefined) args.push("-H", "Content-Type: application/json", "-d", body);
    return compose(args);
}

// 지울 테이블 목록과 순서는 tracer-domain의 분류가 소유하므로 여기서 다시 적지 않는다.
async function loadRebuildPlan() {
    const module = await import("../packages/server/libs/tracer-domain/src/persistence/projection.tables.js");
    return module;
}

// 투영 events는 타임라인 kind만 담고 세션·태스크 생명주기 kind는 sessions·tasks로 들어가
// events에는 남지 않으므로 원장 전체 건수와 비교하면 항상 어긋난 것처럼 보인다.
async function timelineKindList() {
    const { TIMELINE_EVENT_KINDS } = await import("../packages/kernel/src/ingest/event.kind.const.js");
    return TIMELINE_EVENT_KINDS.map((kind) => `'${kind}'`).join(", ");
}

// 슬롯이 비활성이 될 때까지 기다리며 이미 없으면 곧바로 통과한다.
async function waitForSlotInactive(timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const state = psql(
            "runtime-db",
            "runtime",
            `SELECT coalesce((SELECT active FROM pg_replication_slots WHERE slot_name = '${SLOT}'), false)`,
        );
        if (state !== "t") return;
        if (Date.now() > deadline) {
            throw new Error(`복제 슬롯 ${SLOT}이 아직 활성이다. 커넥터가 멈추지 않았다.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
}

async function main() {
    if (!process.argv.includes("--confirm")) {
        process.stderr.write(
            "투영을 통째로 지우고 원장에서 다시 만든다. 되돌릴 수 없다.\n" +
            "실행하려면 --confirm 을 붙여라: npm run projection:rebuild -- --confirm\n",
        );
        process.exit(1);
    }

    const { REBUILD_TRUNCATE_ORDER, assertRebuildable } = await loadRebuildPlan();
    // 화이트리스트를 한 번 더 통과시키며 분류가 틀리면 여기서 멈춘다.
    for (const table of REBUILD_TRUNCATE_ORDER) assertRebuildable(table);

    const kinds = await timelineKindList();
    const ledgerCount = psql("runtime-db", "runtime", `SELECT count(*) FROM events WHERE kind IN (${kinds})`);
    process.stdout.write(`[rebuild] 원장의 타임라인 이벤트 ${ledgerCount}건에서 투영을 재생성한다\n`);

    process.stdout.write("[rebuild] projector를 멈춘다\n");
    compose(["stop", "projector"]);

    process.stdout.write(`[rebuild] 투영 테이블을 비운다: ${REBUILD_TRUNCATE_ORDER.join(", ")}\n`);
    const truncate = REBUILD_TRUNCATE_ORDER.map((table) => `"${table}"`).join(", ");
    psql("tracer-db", "tracer", `TRUNCATE TABLE ${truncate} RESTART IDENTITY CASCADE`);

    process.stdout.write("[rebuild] 커넥터를 멈추고 저장된 오프셋을 지운다\n");
    // 커넥터를 지워도 Connect 내부 오프셋 저장소는 남아 같은 이름으로 다시 만들면 저장된
    // 오프셋에서 이어받으므로 재스냅샷하려면 오프셋을 명시적으로 지워야 한다.
    try {
        connectApi("PUT", `/connectors/${CONNECTOR}/stop`);
        connectApi("DELETE", `/connectors/${CONNECTOR}/offsets`);
    } catch {
        // 커넥터가 이미 없으면 멈추고 지울 것도 없다.
    }
    process.stdout.write("[rebuild] 커넥터와 복제 슬롯을 지운다\n");
    try {
        connectApi("DELETE", `/connectors/${CONNECTOR}`);
    } catch {
        // 커넥터가 이미 없으면 지울 것이 없다.
    }
    // 커넥터 삭제는 비동기라 태스크가 완전히 멈춰 슬롯이 풀릴 때까지 기다리지 않으면
    // drop이 "replication slot is active"로 실패한다.
    await waitForSlotInactive();
    psql("runtime-db", "runtime", `SELECT pg_drop_replication_slot('${SLOT}') WHERE EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${SLOT}' AND NOT active)`);

    process.stdout.write("[rebuild] 토픽을 지운다. 새 스냅샷에 옛 레코드가 섞이지 않게 한다\n");
    try {
        compose(["exec", "-T", "redpanda", "rpk", "topic", "delete", TOPIC]);
    } catch {
        // 토픽이 없으면 지울 것이 없다.
    }

    process.stdout.write("[rebuild] 컨슈머 그룹 오프셋을 지운다\n");
    for (const group of CONSUMER_GROUPS) {
        try {
            compose(["exec", "-T", "redpanda", "rpk", "group", "delete", group]);
        } catch {
            // 그룹이 없으면 지울 것이 없다.
        }
    }

    process.stdout.write("[rebuild] 커넥터를 다시 만든다. snapshot.mode=initial이 원장을 재스냅샷한다\n");
    compose(["up", "-d", "connect-init"]);

    process.stdout.write("[rebuild] projector를 다시 띄운다\n");
    compose(["up", "-d", "projector"]);

    process.stdout.write(
        "[rebuild] 재투영이 진행 중이다. 아래로 진척을 확인하라.\n" +
        `  기대 건수(타임라인 kind): ${ledgerCount}\n` +
        "  현재 건수: docker compose exec -T tracer-db psql -U monitor -d tracer -tAc 'SELECT count(*) FROM events'\n",
    );
}

await main();
