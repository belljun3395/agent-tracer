# Agent Tracer — 성능 개선 계획 (AS-IS / TO-BE)

> Claude Code hook 발화 → `@monitor/runtime` → `@monitor/server` 경로의 latency / throughput 병목을 측정 가능한 형태로 드러내고, 두 단계의 구조 변경(① tsx 제거 → 사전 컴파일 JS, ② 로컬 데몬 + UDS fire-and-forget)으로 개선한다. 모든 개선은 Prometheus 지표로 정량화한다.

---

## 1. 측정 대상 — 무엇을 지표로 잡는가

### 1.1 핵심 지표 (KPI)

| 분류 | 지표 | 단위 | 측정 위치 | 목표 (TO-BE) |
|---|---|---|---|---|
| **End-to-end** | hook fan-out latency p50 / p95 / p99 | ms | runtime (hook 프로세스 wall-clock) | p99 < 10ms (현재 200~400ms 추정) |
| **End-to-end** | hook 프로세스 cold start | ms | runtime (`process.hrtime`) | < 80ms (현재 150~400ms) |
| **Server (RED)** | `/ingest/v1/*` HTTP duration p50 / p95 / p99 | ms | server (OTel auto-instrumentation) | p99 < 50ms @ 200 RPS |
| **Server (RED)** | `/ingest/v1/*` request rate | req/s | server | 단일 컨테이너 (1 vCPU) 200 RPS 안정 |
| **Server (RED)** | 5xx error rate | % | server | < 0.1% |
| **Server (custom)** | `ingest_events_total` (kind 별) | counter | server interceptor | — (분포 가시화) |
| **Server (custom)** | `ingest_batch_size` p50 / p95 | events/req | server interceptor | batching 도입 후 p50 ≥ 5 |
| **Resource** | CPU 사용률 | % of limit | docker / cAdvisor | < 70% @ 목표 RPS |
| **Resource** | RSS / heap | MB | OTel runtime metrics | RSS < 256MB |
| **DB** | SQLite WAL write duration p99 | ms | server (custom timer) | < 5ms |
| **DB** | event-store append throughput | rows/s | server | 500+ rows/s |

### 1.2 RED + USE 프레임

- **RED** (서비스 단): Rate, Errors, Duration → 위 표의 server 항목
- **USE** (자원 단): Utilization, Saturation, Errors → CPU / RSS / Event Loop Lag

이 두 셋만 있으면 "병목이 어디에 있는가"에 답할 수 있다.

### 1.3 왜 이 지표인가 — 이력서 변환 관점

| 지표 | 이력서 표현 가능한 한 줄 |
|---|---|
| hook cold start (ms) | "tool 호출당 추가 latency p99 380ms → 65ms (83% ↓)" |
| hook fan-out (ms) | "fire-and-forget 데몬 도입으로 hook 프로세스가 서버 응답을 기다리지 않게 변경, p99 latency 95% 감소" |
| ingest p99 + RPS | "1 vCPU / 512MB 컨테이너 기준 ingest 처리량 80 → 240 RPS, p99 latency 320ms → 45ms" |
| ingest_batch_size | "단건 POST 평균 1 → batched 평균 8, DB write/req 비율 87.5% 감소" |
| CPU 사용률 | "동일 부하에서 server CPU 사용률 92% → 38%" |

> 모든 수치는 **동일한 부하 조건(고정 RPS, 동일 CPU/메모리 제한)** 에서 측정해야 비교 가능. 그래서 docker compose에 `cpus`, `mem_limit`을 거는 게 핵심.

---

## 2. 기술적 선택 — AS-IS / TO-BE

### 2.1 단계 ① — Runtime: tsx 제거 → 사전 컴파일 JS

#### AS-IS

```bash
# bin/run-hook.sh — 매 hook마다
exec node $TSX --tsconfig $TSCONFIG hooks/$HOOK_NAME.ts
```

매 호출 비용:
1. Node 프로세스 부팅 (~50–80ms)
2. `tsx`(esbuild) 로드 + 워밍업 (~30–80ms)
3. `*.ts` on-the-fly transpile (~50–200ms, 의존 그래프 크기에 비례)
4. tsconfig path alias(`~shared/*`, `~claude-code/*`) 런타임 해석
5. **이제야** hook 로직 실행 (서버 POST)

→ tool 호출 1회당 100~400ms를 "관측 비용" 으로 매번 지불. PreToolUse는 모든 tool에 직렬로 묶이므로 누적이 크다.

#### TO-BE

빌드 산출물을 미리 만들어두고 `node`로 직접 실행.

```bash
# 빌드 (prepublish 단계)
esbuild --bundle --platform=node --format=esm \
  --outdir=dist/claude-code/hooks \
  --sourcemap=inline \
  src/claude-code/hooks/**/*.ts

# bin/run-hook.sh
exec node "$CLAUDE_PLUGIN_ROOT/dist/claude-code/hooks/$HOOK_NAME.js"
```

얻는 것:
- 트랜스파일 비용 0
- path alias는 빌드 타임에 해소되어 런타임 해석 비용 0
- `--bundle`로 단일 파일이라 Node 모듈 해석 I/O도 0
- tsx 의존성 자체가 제거됨 (배포 산출물이 작아짐)

남는 비용:
- Node 프로세스 부팅 (~50–80ms) — 이건 ②에서 데몬으로 해결

비용:
- `npm run build`에 1단계 추가, 배포 산출물에 `dist/` 동봉
- dev 모드에서는 기존 tsx fallback 유지 (run-hook.sh가 `dist/`가 없을 때 자동 fallback)
- 디버깅용 sourcemap 필요 → `--sourcemap=inline`

#### 측정 방법

- `npm run bench:hook -- --hook PreToolUse --iterations 100 --warmup 10 --label as-is-pretooluse` → hook 프로세스 wall-clock 분포
- `npm run bench:hook -- --hook SessionStart --iterations 100 --warmup 10 --label as-is-sessionstart` → session ensure + event post 포함 분포
- runtime 코드에 `const startedAt = process.hrtime.bigint();` 추가, hook 마지막에 `cold_start_ms` 라벨로 OTel histogram 기록 (서버에 함께 전송) — 후속 개선 후보

### 2.2 단계 ② — Runtime: 로컬 데몬 + UDS fire-and-forget

#### AS-IS — 진짜 문제는 동기 fetch

```ts
// shared/transport/transport.ts
export async function postJson(...) {
    const response = await fetch(`${resolveApiBase()}${pathname}`, {
        method: "POST",
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000),  // ← 상한 2초, 평균은 그보다 작지만 0이 아님
    });
    ...
}
```

매 hook 프로세스가 서버 응답을 기다린 뒤에야 종료된다 → Claude Code의 다음 동작도 그만큼 늦어짐. 서버가 1초 걸리면 Claude도 1초 더 멈춘다.

#### TO-BE — 데몬으로 분리

```
Claude Code hook (단발 프로세스)
  └─ UDS write(NDJSON line) ──► agent-tracer-daemon (long-running)
                                  ├─ in-memory queue
                                  ├─ HTTP keep-alive pool (Agent / Undici)
                                  └─ batched POST → 모니터 서버 (50ms window)
hook은 write 끝나자마자 exit (sub-ms)
```

설계 결정:
- **위치**: `packages/runtime/src/daemon/` 신설
- **소켓**: `~/.agent-tracer/daemon.sock` (UDS, mode 0600)
- **프로토콜**: NDJSON over UDS — 한 줄 = 한 이벤트. (gRPC/protobuf까지 갈 필요 없음)
- **수명 관리**:
  - hook이 매번 UDS connect 시도 → 실패 시 `spawn detached`로 띄우고 본인은 즉시 send 후 exit
  - 데몬은 idle 5분 timeout 시 자가 종료
  - `flock`으로 다중 인스턴스 방지
- **백프레셔**: 모니터 다운 시 디스크에 spool, 복구 시 재전송
- **순서**: 단일 큐 → 자연스럽게 FIFO 보장

얻는 것:
- hook 종료 시간이 서버 응답에 의존하지 않음 (모니터 죽어도 Claude Code 영향 0)
- 배치 + keep-alive로 서버 처리량/CPU 동시에 감소

남는 복잡도:
- `sessions/ensure`처럼 응답값이 즉시 필요한 호출 처리:
  - **(a)** 동기 RPC 채널 유지 (UDS request/response — HTTP보다 빠르지만 여전히 blocking)
  - **(b)** 서버를 더 idempotent하게 만들고 hook에서 deterministic ID 생성 (`runtimeSessionId` 해시) → ensure 응답 안 기다림
  - 1차 구현은 **(a)**, 2차에서 **(b)**로 마이그레이션
- 좀비/고스트 데몬, 다중 Claude 인스턴스 시나리오 등 lifecycle 코드가 새로 생김 — 가장 실수하기 쉬운 부분이라 통합 테스트 우선
- 보안: UDS 권한 0600, sock 위치는 사용자 홈 (`$HOME/.agent-tracer/`)

#### 측정 방법

- daemon 도입 전후로 동일 k6 부하 (예: 200 RPS) 걸고:
  - hook fan-out p99
  - server CPU 사용률
  - server `http.server.duration_count` 의 변화
- batch 효과는 `ingest_batch_size` 히스토그램 평균 변화로 직접 가시화

---

## 3. 측정 인프라 — OpenTelemetry + Prometheus + Grafana

### 3.1 왜 이 스택인가

| 후보 | 채택 여부 | 이유 |
|---|---|---|
| `prom-client` 직접 사용 | ✗ | trace + metric 통합이 안 됨. 이력서에 "OTel 도입" 한 줄이 더 강함. |
| OTel + OTLP gRPC + Tempo | ✗ | 이번 범위는 metric만. trace는 후속. |
| **OTel SDK + Prometheus exporter (pull)** | **✓** | metric만 깔끔하게 노출. Prometheus가 scrape. 표준 패턴. |
| Datadog / New Relic | ✗ | OSS 외부 의존. 로컬 벤치마크 환경에 부적합. |

### 3.2 구성

```
[server container]                     [prometheus]                [grafana]
  NestJS                                  scrape                      query
   ├─ @opentelemetry/sdk-node     ──:9464/metrics──►   /api/v1/query  ──►   dashboard
   │   ├─ auto-instrumentation              ▲
   │   │   ├─ http   → http.server.duration │
   │   │   └─ express                       │
   │   └─ Prometheus exporter ──────────────┘
   └─ IngestMetricsInterceptor (custom)
        ├─ ingest_events_total (counter, labels: route, kind)
        └─ ingest_batch_size  (histogram, labels: route)
```

### 3.3 자동으로 얻는 메트릭 (auto-instrumentation)

- `http.server.duration` (histogram) — RED의 D
- `http.server.request.size` (histogram)
- `http.server.response.size` (histogram)
- `process.runtime.nodejs.event_loop_lag` (히스토그램, USE의 Saturation)
- `process.runtime.nodejs.memory.heap.{used,total}` (gauge)

### 3.4 커스텀 메트릭 (`IngestMetricsInterceptor`)

- `ingest_events_total{route, kind}` — counter
- `ingest_batch_size{route}` — histogram (1, 2, 5, 10, 20, 50, 100, 200, 500)

### 3.5 Docker 자원 제약

```yaml
server:
  cpus: 1.0          # 정확히 1 vCPU
  mem_limit: 512m
  mem_reservation: 256m
```

→ 모든 벤치마크는 이 한도 안에서 실행. AS-IS / TO-BE 비교가 의미를 가지려면 자원 한도가 동일해야 한다. "200 RPS 처리"라는 표현이 가능해진다.

---

## 4. 구현 계획

### Phase 0 — 측정 인프라 (이번 PR에서 완료)

- [x] OTel SDK + Prometheus exporter 추가
- [x] `IngestMetricsInterceptor` (events/batch counter)
- [x] Docker compose에 prometheus + grafana 서비스 추가
- [x] Server 컨테이너에 CPU/메모리 한도
- [x] Grafana 데이터소스 + 대시보드 provisioning
- [x] k6 부하 스크립트 (`observability/k6/ingest-events.js`)

### Phase 1 — Baseline 측정

1. `bash scripts/start-docker.sh` → server + prometheus + grafana 기동
2. `docker compose --profile bench run --rm k6` → 200 RPS / 2분 부하
3. Grafana 대시보드 캡처 + Prometheus 쿼리 결과 표 정리
4. **Baseline 문서 갱신**: `docs/guide/performance-baseline.md` (이 문서와 별도)

### Phase 2 — tsx 제거

1. `packages/runtime/build.ts` — esbuild bundle script
2. `bin/run-hook.sh` — `dist/` 우선, tsx fallback
3. CI에 `npm run build --workspace=@monitor/runtime` 추가
4. **재측정** → AS-IS 대비 hook cold start 비교

### Phase 3 — 데몬 + UDS

1. `packages/runtime/src/daemon/` — 데몬 본체 (NDJSON over UDS, 배치 송신)
2. `shared/transport/transport.ts` — daemon-aware fallback
3. `sessions/ensure` 동기 RPC 또는 deterministic ID 마이그레이션
4. **재측정** → hook fan-out p99, server CPU, batch size

### Phase 4 — Resume용 결과 정리

각 Phase의 baseline 캡처 + grafana 스크린샷을 다음 형식으로 정리:

```markdown
## 개선 #1: tsx 제거

| 지표 | AS-IS | TO-BE | 변화 |
|---|---|---|---|
| hook cold start p50 | 187ms | 62ms | -67% |
| hook cold start p99 | 412ms | 89ms | -78% |
| 200 RPS 부하 시 server CPU | 88% | 84% | -4%p |

(Grafana 스크린샷 첨부)
```

---

## 5. 운영 — 대시보드 보는 법

### 5.1 핵심 PromQL

```promql
# /ingest/v1/events p99 latency (ms)
histogram_quantile(0.99,
  sum by (le) (rate(http_server_request_duration_bucket{http_route="/ingest/v1/events"}[1m]))
) * 1000

# RPS by route
sum by (http_route) (rate(http_server_request_duration_count[1m]))

# 5xx error rate
sum(rate(http_server_request_duration_count{http_response_status_code=~"5.."}[1m]))
  / sum(rate(http_server_request_duration_count[1m]))

# 평균 batch size
rate(ingest_batch_size_sum[1m]) / rate(ingest_batch_size_count[1m])

# Events/sec by kind
sum by (kind) (rate(ingest_events_total[1m]))

# Event loop delay p99 (seconds)
nodejs_eventloop_delay_p99
```

### 5.2 Grafana 접속

- URL: http://localhost:3000
- 익명 Viewer 활성화 (provisioning에 포함) → 로그인 없이 dashboard 조회 가능
- 기본 대시보드: "Agent Tracer — Ingest Performance"

---

## 6. 측정 → 이력서 변환 체크리스트

다음 형식으로 1줄씩 정리하면 그대로 이력서 한 줄이 된다:

- [ ] **컨테이너 자원 한도**: 어떤 환경에서 측정한 수치인가 (1 vCPU / 512MB)
- [ ] **부하 조건**: 어떤 부하를 얼마나 걸었는가 (k6, 200 RPS, 2분, batch=5)
- [ ] **AS-IS 수치**: 개선 전 (스크린샷 + 표)
- [ ] **TO-BE 수치**: 개선 후 (스크린샷 + 표)
- [ ] **변화율**: %, ×배 단위로 환산
- [ ] **기술적 선택의 이유**: 왜 그 방법을 골랐고 어떤 대안을 버렸는가 (이 문서의 §2)

---

## 부록 A — 향후 작업 (Phase 5+)

- SQLite write duration custom timer (`event-store/event.store.ts` 의 `db.prepare(...).run()` 주변)
- TypeORM EntitySubscriber overhead 분리 측정 (subscriber on/off A/B)
- Trace export (OTLP gRPC → Tempo or Jaeger) — request → SQL until response 가시화
- Hot path만이라도 prepared statement cache hit ratio 노출
