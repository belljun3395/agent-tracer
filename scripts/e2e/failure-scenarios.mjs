// 손으로 확인하던 복구 경로를 결정적 실패 시나리오 회귀 게이트로 만들며 인프라가 떠
// 있어야 하고(npm run infra:up) 느려서 CI 메인 경로가 아니라 야간과 수동으로 돈다.
//
//   npm run e2e:failure                    재생 멱등성 + projector 재기동 (비파괴)
//   npm run e2e:failure -- --rebuild       위 + 슬롯 재생성 리빌드 (투영을 통째로 재생성)
import { execFileSync } from "node:child_process";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const INGEST_URL = "http://127.0.0.1:3901/ingest/v1/events";
// 데몬이 자기 매니페스트 버전을 계약 버전으로 실어 보내므로 여기서도 같은 값을 읽는다.
const CONTRACT_VERSION = JSON.parse(
    readFileSync(new URL("../../packages/runtime/package.json", import.meta.url), "utf8"),
).version;
const USER = "e2e-failure";

function compose(args) {
    return execFileSync("docker", ["compose", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function psql(service, database, sql) {
    return compose(["exec", "-T", service, "psql", "-U", "monitor", "-d", database, "-tAc", sql]);
}

function count(service, database, sql) {
    return Number.parseInt(psql(service, database, sql), 10);
}

async function waitFor(label, predicate, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await predicate()) return;
        if (Date.now() > deadline) throw new Error(`시간 초과: ${label}`);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
}

function ulid() {
    // 서버는 클라이언트가 정한 id를 멱등키로 쓰므로 형식만 맞으면 되어 26자 Crockford로 만든다.
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const raw = randomUUID().replace(/-/g, "");
    let out = "";
    for (let i = 0; i < 26; i += 1) out += alphabet[Number.parseInt(raw[i % raw.length], 16) % 32];
    return out;
}

function ingestBatch(events) {
    const body = JSON.stringify({ contractVersion: CONTRACT_VERSION, events });
    return execFileSync(
        "curl",
        ["-sf", "-X", "POST", INGEST_URL, "-H", "Content-Type: application/json", "-H", `x-monitor-user: ${USER}`, "-d", body],
        { encoding: "utf8" },
    );
}

function sampleEvent(id, taskId) {
    return {
        id,
        kind: "agent_tracer.thought.logged",
        taskId,
        occurredAt: new Date().toISOString(),
        payload: { title: "e2e 실패 시나리오", body: "같은 배치를 두 번 보내도 한 번만 저장돼야 한다" },
    };
}

// 1) 재생 멱등성: 같은 배치를 두 번 인제스트해도 원장에 한 번만 남고 투영도 한 번만 반영된다.
async function replayIdempotency() {
    const id = ulid();
    const taskId = `e2e-task-${id.slice(0, 8)}`;
    const events = [sampleEvent(id, taskId)];

    ingestBatch(events);
    ingestBatch(events);

    const ledger = count("runtime-db", "runtime", `SELECT count(*) FROM events WHERE id = '${id}'`);
    if (ledger !== 1) throw new Error(`원장에 ${ledger}건이 남았다. 멱등키가 재전송을 흡수하지 못했다`);

    await waitFor("투영 반영", () => count("tracer-db", "tracer", `SELECT count(*) FROM events WHERE id = '${id}'`) === 1);

    const projected = count("tracer-db", "tracer", `SELECT count(*) FROM events WHERE id = '${id}'`);
    if (projected !== 1) throw new Error(`투영에 ${projected}건이 남았다. 재생이 중복 투영됐다`);

    psql("tracer-db", "tracer", `DELETE FROM events WHERE id = '${id}'`);
    psql("runtime-db", "runtime", `DELETE FROM events WHERE id = '${id}'`);
    return "같은 배치를 두 번 보내도 원장·투영 모두 1건";
}

// 2) 배치 도중 종료: projector를 죽였다가 되살려도 커서에서 이어 읽고 중복 투영하지 않는다.
async function projectorMidBatchKill() {
    const ids = Array.from({ length: 20 }, () => ulid());
    const taskId = `e2e-task-${ids[0].slice(0, 8)}`;

    compose(["kill", "projector"]);
    ingestBatch(ids.map((id) => sampleEvent(id, taskId)));
    compose(["up", "-d", "projector"]);

    const inList = ids.map((id) => `'${id}'`).join(",");
    await waitFor(
        "재기동 후 재소비",
        () => count("tracer-db", "tracer", `SELECT count(*) FROM events WHERE id IN (${inList})`) === ids.length,
        120_000,
    );

    const projected = count("tracer-db", "tracer", `SELECT count(*) FROM events WHERE id IN (${inList})`);
    if (projected !== ids.length) throw new Error(`${ids.length}건 중 ${projected}건만 투영됐다`);

    psql("tracer-db", "tracer", `DELETE FROM events WHERE id IN (${inList})`);
    psql("runtime-db", "runtime", `DELETE FROM events WHERE id IN (${inList})`);
    return `죽은 사이 들어온 ${ids.length}건을 재기동 후 빠짐없이 한 번씩 투영`;
}

// 3) 슬롯 재생성은 투영을 통째로 지우고 원장에서 다시 만들어도 원장과 일치하며
// `npm run projection:rebuild`의 절차를 그대로 밟아 리빌드의 상시 리허설이 된다.
async function slotRecreationRebuild() {
    const { TIMELINE_EVENT_KINDS } = await import("../../packages/kernel/src/ingest/event.kind.const.js");
    const kinds = TIMELINE_EVENT_KINDS.map((kind) => `'${kind}'`).join(",");
    const expected = count("runtime-db", "runtime", `SELECT count(*) FROM events WHERE kind IN (${kinds})`);

    execFileSync("npm", ["run", "projection:rebuild", "--", "--confirm"], { stdio: "inherit" });

    await waitFor(
        "재투영 완료",
        () => count("tracer-db", "tracer", "SELECT count(*) FROM events") >= expected,
        600_000,
    );

    const rebuilt = count("tracer-db", "tracer", "SELECT count(*) FROM events");
    if (rebuilt < expected) throw new Error(`재투영이 ${expected}건 중 ${rebuilt}건에서 멈췄다`);
    return `원장의 타임라인 ${expected}건을 투영으로 재생성`;
}

const SCENARIOS = [
    { name: "재생 멱등성", run: replayIdempotency, destructive: false },
    { name: "projector 배치 도중 종료", run: projectorMidBatchKill, destructive: false },
    { name: "슬롯 재생성 리빌드", run: slotRecreationRebuild, destructive: true, flag: "--rebuild" },
];

async function main() {
    let failed = 0;

    for (const scenario of SCENARIOS) {
        if (scenario.destructive && !process.argv.includes(scenario.flag)) {
            process.stdout.write(`- 건너뜀 ${scenario.name} (파괴적이다. ${scenario.flag} 로 켠다)\n`);
            continue;
        }
        try {
            const detail = await scenario.run();
            process.stdout.write(`✓ ${scenario.name}: ${detail}\n`);
        } catch (error) {
            failed += 1;
            process.stderr.write(`✗ ${scenario.name}: ${error instanceof Error ? error.message : String(error)}\n`);
        }
    }

    if (failed > 0) process.exit(1);
    process.stdout.write("결정적 실패 시나리오 통과\n");
}

await main();
