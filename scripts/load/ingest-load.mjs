// 합성 에이전트 활동을 실제 수집 엔드포인트로 대량 밀어넣어 처리량·투영 지연·읽기 조회를 한 번에 잰다.
//
//   node scripts/load/ingest-load.mjs --tasks 1000 --sessions-per-task 3 --events-per-session 200    대량 적재만
//   node scripts/load/ingest-load.mjs --tasks 50 --measure-lag --measure-read                        지연·조회까지 측정
//
// 인프라와 두 API가 떠 있어야 하며 같은 taskId 쓰기는 seq로 직렬화되니 부하는 여러 독립 task로 분산
import process from "node:process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const CONTRACT_VERSION = JSON.parse(
    readFileSync(new URL("../../packages/runtime/package.json", import.meta.url), "utf8"),
).version;

const DEFAULTS = {
    "write-url": "http://127.0.0.1:3901",
    "read-url": "", // 비면 write-url에서 유추: :3901→:3902(dev), 그 외는 그대로(stack edge)
    user: "load",
    tasks: 1000,
    "sessions-per-task": 3,
    "events-per-session": 200,
    concurrency: 16,
    "batch-size": 100, // 서버 상한
    "measure-lag": false,
    "lag-samples": 20,
    "lag-timeout-ms": 60_000,
    "measure-read": false,
    "read-queries": 200,
};

function parseArgs(argv) {
    const config = { ...DEFAULTS };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        if (!(key in DEFAULTS)) throw new Error(`알 수 없는 옵션: --${key}`);
        if (typeof DEFAULTS[key] === "boolean") {
            config[key] = true;
            continue;
        }
        const value = argv[i + 1];
        i += 1;
        config[key] = typeof DEFAULTS[key] === "number" ? Number.parseInt(value, 10) : value;
    }
    if (!config["read-url"]) {
        config["read-url"] = config["write-url"].replace(":3901", ":3902");
    }
    return config;
}

// 읽기 모델은 세션 생명주기·telemetry를 뺀 투영 kind만 담으므로 그중에서만 lag 탐침을 고른다
const TIMELINE_KINDS = new Set(["execute_tool", "agent_tracer.user.message", "agent_tracer.assistant.response"]);

function ulid() {
    // 서버는 클라이언트 id를 멱등키로 쓰므로 형식(26자 Crockford)만 맞으면 된다.
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const raw = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    let out = "";
    for (let i = 0; i < 26; i += 1) out += alphabet[Number.parseInt(raw[i], 16) % 32];
    return out;
}

// 도구 호출이 압도적 다수인 실제 코딩 턴의 kind 믹스를 한 세션 분량으로 만든다.
function buildSessionEvents(taskId, sessionId, eventCount, clock) {
    const events = [];
    const at = () => new Date(clock.next()).toISOString();
    events.push({
        id: ulid(),
        kind: "agent_tracer.session.started",
        taskId,
        sessionId,
        occurredAt: at(),
        payload: { runtimeSource: "claude-code", runtimeSessionId: sessionId, title: "부하 세션" },
    });

    let remaining = Math.max(1, eventCount - 2); // session.started/ended 제외
    let turnIndex = 0;
    while (remaining > 0) {
        const turnId = `${sessionId}-turn-${turnIndex}`;
        turnIndex += 1;
        events.push({
            id: ulid(),
            kind: "agent_tracer.user.message",
            taskId,
            sessionId,
            turnId,
            occurredAt: at(),
            payload: { lane: "user", title: "사용자 발화", body: "부하 테스트 합성 발화", promptOrigin: "user" },
        });
        remaining -= 1;

        const toolsThisTurn = Math.min(remaining, 8 + (turnIndex % 5) * 4);
        for (let t = 0; t < toolsThisTurn && remaining > 0; t += 1) {
            events.push({
                id: ulid(),
                kind: "execute_tool",
                taskId,
                sessionId,
                turnId,
                occurredAt: at(),
                payload: {
                    lane: "implementation",
                    title: "도구 실행",
                    body: "합성 도구 호출",
                    metadata: { "gen_ai.tool.name": "Bash", "agent_tracer.command": "npm test" },
                },
            });
            remaining -= 1;
        }

        if (remaining > 0) {
            events.push({
                id: ulid(),
                kind: "gen_ai.client.inference.operation.details",
                taskId,
                sessionId,
                occurredAt: at(),
                payload: { inputTokens: 1200, outputTokens: 480, model: "claude-opus-4-8", promptId: turnId },
            });
            remaining -= 1;
        }
        if (remaining > 0) {
            events.push({
                id: ulid(),
                kind: "agent_tracer.assistant.response",
                taskId,
                sessionId,
                turnId,
                occurredAt: at(),
                payload: { lane: "assistant", title: "어시스턴트 응답", body: "합성 응답" },
            });
            remaining -= 1;
        }
    }

    events.push({
        id: ulid(),
        kind: "agent_tracer.session.ended",
        taskId,
        sessionId,
        occurredAt: at(),
        payload: { runtimeSource: "claude-code", runtimeSessionId: sessionId },
    });
    return events;
}

// occurred_at은 시간 파티션 키라 과거 창을 잘게 전진시키며 타임스탬프를 흩는다
function makeClock(totalEvents) {
    let cursor = Date.now() - totalEvents * 1000;
    return {
        next() {
            cursor += 1000;
            return cursor;
        },
    };
}

function* planBatches(config) {
    const perTask = config["sessions-per-task"] * config["events-per-session"];
    const clock = makeClock(config.tasks * perTask);
    let batch = [];
    const flush = function* () {
        if (batch.length > 0) {
            yield batch;
            batch = [];
        }
    };
    for (let taskIndex = 0; taskIndex < config.tasks; taskIndex += 1) {
        const taskId = `load-${ulid().slice(0, 10)}`;
        for (let s = 0; s < config["sessions-per-task"]; s += 1) {
            const sessionId = `${taskId}-s${s}`;
            for (const event of buildSessionEvents(taskId, sessionId, config["events-per-session"], clock)) {
                batch.push(event);
                if (batch.length >= config["batch-size"]) yield* flush();
            }
        }
    }
    yield* flush();
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

// 429는 데몬과 동일하게 재시도 대상이라 Retry-After만큼 백오프한 뒤 같은 배치를 다시 보낸다.
async function postBatch(config, events) {
    const started = performance.now();
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(`${config["write-url"]}/ingest/v1/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-monitor-user": config.user },
            body: JSON.stringify({ contractVersion: CONTRACT_VERSION, events }),
        });
        if (response.status === 429 && attempt < 8) {
            const retryAfter = Number.parseFloat(response.headers.get("retry-after") || "1");
            await new Promise((r) => setTimeout(r, Math.max(50, retryAfter * 1000)));
            continue;
        }
        const latency = performance.now() - started;
        let rejected = 0;
        if (response.ok) {
            const body = await response.json().catch(() => ({}));
            rejected = Array.isArray(body.rejected) ? body.rejected.length : 0;
        } else {
            await response.text().catch(() => "");
        }
        return { status: response.status, latency, rejected, retries: attempt };
    }
}

async function runIngest(config) {
    const batches = [...planBatches(config)];
    const totalEvents = batches.reduce((sum, b) => sum + b.length, 0);
    const samples = [];
    if (config["measure-lag"] || config["measure-read"]) {
        const stride = Math.max(1, Math.floor(batches.length / config["lag-samples"]));
        for (let i = 0; i < batches.length; i += stride) {
            const probe = [...batches[i]].reverse().find((event) => TIMELINE_KINDS.has(event.kind));
            if (probe) samples.push({ taskId: probe.taskId, id: probe.id });
        }
    }

    const metrics = { total: totalEvents, batches: batches.length, accepted: 0, rejected: 0, retries: 0, latencies: [], byStatus: {} };
    let cursor = 0;
    const startWall = performance.now();
    const worker = async () => {
        for (;;) {
            const index = cursor;
            cursor += 1;
            if (index >= batches.length) return;
            const result = await postBatch(config, batches[index]);
            metrics.latencies.push(result.latency);
            metrics.retries += result.retries;
            metrics.byStatus[result.status] = (metrics.byStatus[result.status] || 0) + 1;
            if (result.status >= 200 && result.status < 300) {
                metrics.accepted += batches[index].length - result.rejected;
                metrics.rejected += result.rejected;
            } else {
                metrics.rejected += batches[index].length;
            }
        }
    };
    await Promise.all(Array.from({ length: config.concurrency }, worker));
    metrics.elapsedMs = performance.now() - startWall;
    return { metrics, samples };
}

async function measureLag(config, samples, sentAtWall) {
    const results = [];
    for (const sample of samples) {
        const deadline = Date.now() + config["lag-timeout-ms"];
        const started = performance.now();
        let found = false;
        while (Date.now() < deadline && !found) {
            // 기본은 최신 페이지, nextCursor로 과거로 훑어 탐침 id를 찾는다(태스크당 페이지 상한).
            let cursor = "";
            for (let page = 0; page < 30; page += 1) {
                const query = `limit=100${cursor ? `&cursor=${cursor}` : ""}`;
                const response = await fetch(
                    `${config["read-url"]}/api/v1/tasks/${sample.taskId}/timeline?${query}`,
                    { headers: { "x-monitor-user": config.user } },
                );
                if (!response.ok) break;
                const body = await response.json().catch(() => ({}));
                const data = body.data || body;
                if ((data.items || []).some((item) => item.id === sample.id)) {
                    found = true;
                    break;
                }
                if (!data.nextCursor) break;
                cursor = data.nextCursor;
            }
            if (!found) await new Promise((r) => setTimeout(r, 250));
        }
        results.push({ found, lagMs: found ? performance.now() - started : null });
    }
    const lags = results.filter((r) => r.found).map((r) => r.lagMs).sort((a, b) => a - b);
    const missed = results.filter((r) => !r.found).length;
    return { sampled: samples.length, visible: lags.length, missed, sinceIngest: performance.now() - sentAtWall, lags };
}

async function measureRead(config, taskIds) {
    if (taskIds.length === 0) return null;
    const latencies = [];
    for (let i = 0; i < config["read-queries"]; i += 1) {
        const taskId = taskIds[i % taskIds.length];
        const started = performance.now();
        const response = await fetch(`${config["read-url"]}/api/v1/tasks/${taskId}/timeline?limit=50`, {
            headers: { "x-monitor-user": config.user },
        });
        await response.text().catch(() => "");
        latencies.push(performance.now() - started);
    }
    latencies.sort((a, b) => a - b);
    return { queries: latencies.length, p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99: percentile(latencies, 99) };
}

function report(config, ingest, lag, read) {
    const { metrics } = ingest;
    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const seconds = metrics.elapsedMs / 1000;
    const lines = [
        "=== 수집 처리량 ===",
        `이벤트 ${metrics.total} · 배치 ${metrics.batches} · 동시성 ${config.concurrency} · 계약버전 ${CONTRACT_VERSION}`,
        `수용 ${metrics.accepted} · 거부 ${metrics.rejected} · 재시도(429 백오프) ${metrics.retries}`,
        `상태코드 ${JSON.stringify(metrics.byStatus)}`,
        `소요 ${seconds.toFixed(1)}s · 처리량 ${Math.round(metrics.total / seconds)} events/s · ${Math.round(metrics.batches / seconds)} batches/s`,
        `배치 지연 p50 ${percentile(sorted, 50).toFixed(0)}ms · p95 ${percentile(sorted, 95).toFixed(0)}ms · p99 ${percentile(sorted, 99).toFixed(0)}ms`,
    ];
    if (lag) {
        const l = [...lag.lags].sort((a, b) => a - b);
        lines.push(
            "",
            "=== 투영/CDC 지연 (ingest→timeline 가시성) ===",
            `표본 ${lag.sampled} · 가시 ${lag.visible} · 미도달 ${lag.missed}`,
            lag.visible > 0
                ? `가시화 지연 p50 ${percentile(l, 50).toFixed(0)}ms · p95 ${percentile(l, 95).toFixed(0)}ms · max ${Math.max(...l).toFixed(0)}ms`
                : "가시화된 표본 없음 (타임아웃 상향 또는 투영 파이프라인 점검)",
        );
    }
    if (read) {
        lines.push(
            "",
            "=== 읽기 조회 성능 (timeline) ===",
            `쿼리 ${read.queries} · p50 ${read.p50.toFixed(0)}ms · p95 ${read.p95.toFixed(0)}ms · p99 ${read.p99.toFixed(0)}ms`,
        );
    }
    return lines.join("\n") + "\n";
}

async function main() {
    const config = parseArgs(process.argv.slice(2));
    process.stdout.write(
        `부하 시작: ${config.tasks} tasks × ${config["sessions-per-task"]} sessions × ${config["events-per-session"]} events → ${config["write-url"]}\n`,
    );
    const ingest = await runIngest(config);
    const ingestDoneWall = performance.now();
    const taskIds = [...new Set(ingest.samples.map((s) => s.taskId))];

    let lag = null;
    if (config["measure-lag"]) lag = await measureLag(config, ingest.samples, ingestDoneWall);
    let read = null;
    if (config["measure-read"]) read = await measureRead(config, taskIds);

    process.stdout.write(report(config, ingest, lag, read));
    if (ingest.metrics.rejected > 0) process.exitCode = 1;
}

await main();
