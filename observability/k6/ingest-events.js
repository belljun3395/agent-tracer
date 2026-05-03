// k6 load script — drives /ingest/v1/events at a fixed RPS to produce a
// reproducible baseline for AS-IS / TO-BE comparison.
//
// Usage:
//   docker compose --profile bench run --rm k6
// Tunables (env, mirrored from docker-compose.yml):
//   MONITOR_BASE_URL  base URL of the server (default http://server:3847)
//   K6_DURATION       test duration (default 2m)
//   K6_RPS            requests/sec (default 200)
//   K6_BATCH_SIZE     events per request (default 5)
//
// Setup phase calls /ingest/v1/sessions/ensure once and caches taskId/sessionId
// for all VUs. The default fn posts a batch of N tool.used events under that
// session. Latency / RPS / error thresholds fail the run if regressed.

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.MONITOR_BASE_URL || "http://server:3847";
const DURATION = __ENV.K6_DURATION || "2m";
const RPS = parseInt(__ENV.K6_RPS || "200", 10);
const BATCH_SIZE = parseInt(__ENV.K6_BATCH_SIZE || "5", 10);

export const options = {
    scenarios: {
        ingest_load: {
            executor: "constant-arrival-rate",
            rate: RPS,
            timeUnit: "1s",
            duration: DURATION,
            preAllocatedVUs: Math.max(20, RPS / 4),
            maxVUs: Math.max(100, RPS),
        },
    },
    thresholds: {
        // Tighten these per benchmark run as you iterate.
        http_req_duration: ["p(95)<200", "p(99)<500"],
        http_req_failed: ["rate<0.01"],
    },
};

const HEADERS = { "Content-Type": "application/json" };

export function setup() {
    const runtimeSessionId = `bench-${Date.now()}`;
    const res = http.post(
        `${BASE_URL}/ingest/v1/sessions/ensure`,
        JSON.stringify({
            runtimeSource: "k6-bench",
            runtimeSessionId,
            title: "Agent Tracer benchmark session",
            workspacePath: "/tmp/bench",
        }),
        { headers: HEADERS },
    );
    if (res.status !== 200) {
        throw new Error(`session ensure failed: ${res.status} ${res.body}`);
    }
    const body = res.json();
    // The server wraps responses in `{ ok: true, data: { ... } }`.
    const data = body && body.data ? body.data : body;
    if (!data || !data.taskId || !data.sessionId) {
        throw new Error(`session ensure returned unexpected shape: ${res.body}`);
    }
    return { taskId: data.taskId, sessionId: data.sessionId };
}

export default function (ctx) {
    const events = new Array(BATCH_SIZE);
    for (let i = 0; i < BATCH_SIZE; i++) {
        events[i] = {
            kind: "tool.used",
            taskId: ctx.taskId,
            sessionId: ctx.sessionId,
            title: `Bench event ${__VU}-${__ITER}-${i}`,
            body: "k6 generated payload",
            lane: "implementation",
            metadata: {
                vu: __VU,
                iter: __ITER,
                idx: i,
                source: "k6-bench",
            },
        };
    }
    const res = http.post(`${BASE_URL}/ingest/v1/events`, JSON.stringify({ events }), {
        headers: HEADERS,
        tags: { route: "/ingest/v1/events" },
    });
    check(res, {
        "status is 200": (r) => r.status === 200,
    });
}
