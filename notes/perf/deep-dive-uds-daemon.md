# Deep Dive — Unix Domain Socket Daemon: 단일 사용자에선 무용, multi-user에서 본질

> Phase 3는 hook 클라이언트와 server 사이의 transport를 HTTP에서 **로컬 daemon + UDS**로 교체했다. **단일 사용자 self-hosted 시나리오 (이번 측정)에서는 latency 우위가 통계적으로 없음을 n=200 × 5 runs 측정으로 확인.** Phase 3의 본질적 가치는 hook과 server가 다른 머신에 있는 multi-user / SaaS 시나리오의 server-side scalability에 있다 (§8 참조).

핵심 결과 (n=200, median of 5 runs):

| 구성 | Median p99 | Mean ± stddev (n=5) | hook spread (5 hook p99 max−min) |
|---|---:|---:|---:|
| AS-IS (`node + tsx + HTTP`) | 229.67 ms | n/a | ~50 ms (251.4–203.9) |
| Phase 2 best (`bun + 컴파일 JS + HTTP`) | **34.28 ms** | 137.69 ± 8.30 | ~20 ms (40.8–20.9) |
| Phase 2+3 (`bun + 컴파일 JS + UDS daemon`) | 35.38 ms | 134.24 ± 3.25 | **~8 ms (40.2–32.3)** |

**Phase 2+3 vs Phase 2 단독**: latency 차이는 stddev 안에 묻혀 있어 통계적으로 구별 안 됨. hook 분포는 좁아지지만 메커니즘은 §7.3에서 설명 (burst 흡수 아님).

이 문서는 daemon이 무엇을 하고, 어디에서 가치가 있고 (multi-user — §8), 단일 사용자 측정에서는 왜 latency 우위가 안 보였는지를 설명한다.

---

## 1. 그림으로 본 변화

### Phase 2까지 (HTTP transport)

```
hook 1   ──fetch POST /ingest──> server (NestJS) ──> DB
hook 2   ──fetch POST /ingest──> server           ──> DB
hook 3   ──fetch POST /ingest──> server           ──> DB
...
```

매 hook 호출마다:
- DNS / TCP connect (Docker network 안이라 빠르지만 0은 아님)
- HTTP/1.1 헤더 + JSON body 직렬화
- 서버 응답 대기 (Promise resolve)
- 연결 종료

서버가 같은 host에 있어도 TCP/HTTP framing이 거기 있고, 매 hook마다 새 연결.

### Phase 2+3 (UDS daemon)

```
hook 1 ──UDS write──> daemon ──fetch keep-alive──> server ──> DB
hook 2 ──UDS write──> daemon                    ─┐
hook 3 ──UDS write──> daemon                    ─┴─> 같은 connection 재사용
...
```

Hook은 **로컬 daemon의 Unix Domain Socket에 한 줄을 쓰고 즉시 exit**한다. Daemon이 백그라운드에서 enqueue하고, 이미 열려 있는 HTTP keep-alive connection으로 server에 비동기 전달한다.

**핵심 차이**:
- Hook 입장에서는 "1바이트 쓰고 끝" → exit
- 서버 응답을 기다리지 않음 (fire-and-forget)
- TCP / HTTP는 daemon 쪽에서 한 번만 cost 지불 (long-lived)

---

## 2. 왜 같은 머신 안 통신에 UDS인가 — TCP / HTTP / UDS 비교

### 2.1 TCP / HTTP loopback의 비용

같은 머신의 `127.0.0.1:3847`로 HTTP fetch를 보내도 다음을 거친다:

```
fetch("http://127.0.0.1:3847/ingest")
  ↓
DNS 조회 (cache hit이라도 lookup 비용)
  ↓
TCP socket() + connect()
  ↓
3-way handshake (SYN, SYN-ACK, ACK)  ← loopback이라 빠르지만 ~0.1 ms
  ↓
HTTP/1.1 request line + headers + body 직렬화
  ↓
kernel TCP stack (loopback이지만 IP/포트 라우팅 통과)
  ↓
server: parse HTTP → handler → response → close
  ↓
hook: read response → close socket
```

**같은 머신**에서도 TCP 스택을 통과하고, HTTP framing을 매번 써야 한다. loopback이라 packet drop은 없지만 **kernel 모드 전환**과 **TCP buffer 복사**는 일어난다.

### 2.2 Unix Domain Socket의 차이

UDS는 **같은 머신 내 프로세스 간 통신을 위한 socket**이다. TCP와 같은 socket API를 쓰지만:

| 항목 | TCP loopback | Unix Domain Socket |
|---|---|---|
| 주소 | IP + port | filesystem path (`/tmp/agent-tracer.sock`) |
| 라우팅 | IP layer 통과 | filesystem 노드 + kernel 직통 |
| 3-way handshake | 있음 (loopback shortcut) | **없음** (단순 connect → 즉시 accept) |
| MTU 단편화 | 1500 (loopback은 64 K) | 없음 (kernel buffer copy만) |
| 권한 모델 | 포트는 누구나 connect 가능 | filesystem 권한 (chmod 0600) → **OS 사용자 격리** |
| TLS / TCP 옵션 | 적용 가능 | 불필요 (같은 머신 + filesystem 권한) |

성능 차이는 보통:
- TCP loopback: connect ~0.1 ms, RTT ~0.05 ms
- UDS: connect ~0.02 ms, RTT ~0.01 ms

작아 보이지만 **hook 호출당 매번 0.2 ms** 정도 차이가 누적된다. 더 중요한 건 **HTTP framing을 안 써도 된다**는 점.

### 2.3 그러면 왜 HTTP를 안 쓰고 newline-delimited JSON을 쓰나

UDS에 그대로 HTTP를 얹어도 동작은 한다. 하지만 **hook 입장에서는 응답이 필요 없는 fire-and-forget이 대부분**이다 (이벤트 ingest). HTTP 응답 기다림 자체가 불필요한 오버헤드.

Agent Tracer daemon protocol:

```
{"type":"postJson","pathname":"/ingest/v1/events","body":{...}}\n
{"type":"postJson","pathname":"/ingest/v1/workflow","body":{...}}\n
...
```

newline-delimited JSON. Daemon은 한 줄씩 parse → enqueue. Hook은 한 줄 쓰고 즉시 exit. 응답 기다림 0.

세션 ensure 같이 응답이 필요한 호출도 있지만, 거기엔 **결정적 ID 생성** 트릭으로 대응한다 (4절 참조).

---

## 3. Daemon의 책임 — 무엇을 하나

### 3.1 Daemon = 메모리 상주 + UDS listener + HTTP keep-alive client

```ts
// packages/runtime/src/shared/hook-runtime/local-daemon-entry.ts (요약)
const layout = resolveDaemonHomeLayout();           // /tmp/agent-tracer-*.sock + log path
const direct = createMonitorTransport(config, {forceDirect: true});
const queue: DaemonMessage[] = [];

const server = net.createServer((socket) => parseLines(socket));
server.listen(layout.socketPath);

function enqueue(message: DaemonMessage): void {
    queue.push(message);
    void drain();
}

async function drain(): Promise<void> {
    if (processing) return;
    processing = true;
    try {
        for (;;) {
            const message = queue.shift();
            if (!message) return;
            await direct.postJson(message.pathname, message.body);
        }
    } finally {
        processing = false;
    }
}
```

요점:
- `net.createServer`: UDS listener
- 들어온 줄(`\n` 단위)을 JSON parse → 큐에 push → drain
- `direct.postJson`: HTTP keep-alive client. **연결 한 번 열고 모든 hook 메시지를 그 위로 보낸다**.
- `for (;;) { queue.shift(); ... }`: serial drain. 메시지 순서 보장.

### 3.2 Hook이 daemon에 메시지를 넣는 코드

```ts
// packages/runtime/src/shared/hook-runtime/local-daemon.ts (요약)
function writeMessage(socketPath: string, message: DaemonMessage): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(socketPath);
        socket.setTimeout(SOCKET_IDLE_TIMEOUT_MS, ...);
        socket.once("connect", () => {
            socket.end(`${JSON.stringify(message)}\n`, () => resolve());
        });
    });
}
```

socket connect → write → end. 응답 대기 없음. 정상 hook write 비용은 **1–3 ms 수준**.

### 3.3 Daemon이 없으면? — 자동 spawn

```ts
async function enqueueDaemonMessage(message: DaemonMessage): Promise<void> {
    try {
        await writeMessage(socketPath, message);
        return;
    } catch (err) {
        // ENOENT (소켓 파일 없음) | ECONNREFUSED (daemon이 죽음)
    }

    maybeStartDaemon(layout);                     // 백그라운드로 daemon spawn
    const deadline = Date.now() + DAEMON_SPAWN_DEADLINE_MS;  // 1초
    while (Date.now() < deadline) {
        await sleep(DAEMON_SPAWN_POLL_INTERVAL_MS);   // 25 ms
        try { return await writeMessage(socketPath, message); }
        catch { /* 다시 시도 */ }
    }
    throw new Error("failed to enqueue daemon message");
}
```

첫 hook 호출 때 daemon이 spawn되고, 이후 hook들은 이미 살아있는 daemon에 write만 한다. **사용자는 "daemon을 따로 띄워야 한다"는 걸 의식할 필요 없음**.

`maybeStartDaemon`은 detached child process로 daemon을 띄우고 부모(hook)는 즉시 exit:

```ts
const child = spawn(executable, args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, AGENT_TRACER_DAEMON_CHILD: "1", ... },
});
child.unref();
```

`detached: true` + `child.unref()`: hook 프로세스가 종료되어도 daemon은 살아남음. `AGENT_TRACER_DAEMON_CHILD=1` 환경변수: daemon이 "내가 daemon이다"를 알아 hook 로직을 타지 않게 함.

### 3.4 Bun이냐 Node냐 자동 감지

```ts
const isBun = Boolean((globalThis as any).Bun) || Boolean(process.versions.bun);
const executable = isBun ? process.execPath : tsxBinPath();
const args = isBun ? [daemonEntryPath()] : ["--tsconfig", ..., daemonEntryPath()];
```

Hook이 bun으로 실행 중이면 daemon도 bun으로 띄움. node + tsx 환경이면 daemon도 tsx로 띄움. 사용자 환경에 맞춰 자동 적응.

(이 자동 감지가 없을 때 발생한 사고: bun-only 컨테이너에서 tsx의 `#!/usr/bin/env node` 셔뱅 때문에 daemon이 spawn 직후 죽음 → hook이 매번 1 초 timeout → p99 1083 ms로 폭증. 측정 과정에서 발견하고 수정함.)

---

## 4. 어려운 부분 — `/sessions/ensure`의 응답이 필요한 호출

대부분의 ingest는 fire-and-forget이지만, **세션 시작 시 받은 ID를 hook이 알아야** 다음 이벤트에 그 ID를 붙일 수 있다. 응답이 필요하다.

### 4.1 순진한 해법: hook이 daemon 응답을 기다림

이러면 fire-and-forget이 깨진다. hook은 다시 daemon의 응답을 기다리는 동기 호출이 됨.

### 4.2 Agent Tracer가 쓴 해법: 결정적 placeholder + 서버 발급 ID 사후 rewrite

먼저 server 동작을 정확히 파악할 필요가 있다. `packages/server/src/activity/session/application/ensure.runtime.session.usecase.ts`를 보면:

```ts
// 첫 sighting 분기 (요약)
const result = await this.taskLifecycle.startTask({
    ...(input.taskId ? { taskId: input.taskId } : {}),  // taskId만 client 제안 수용
    title: input.title,
    runtimeSource: input.runtimeSource,
    ...
});
const taskId = result.task.id;
const sessionId = result.sessionId!;   // ← server가 idGen.newUuid()로 자체 발급
```

**핵심**:
- **client가 제안한 sessionId는 무시된다**. server는 항상 자체 `idGen.newUuid()`로 발급.
- `taskId`는 옵셔널 — client가 보내면 사용, 없으면 server 발급.
- idempotency의 **키는 client UUID가 아니라 (`runtimeSource`, `runtimeSessionId`) 쌍**. server는 active runtime binding을 이 쌍으로 찾고, 있으면 **기존 monitorSessionId를 재사용**한다.

따라서 client가 보낸 UUID는 **canonical session ID로 받아들여지지 않는다**. daemon mapping table은 "두 ID가 같은 세션을 가리킨다"를 어딘가 기록해서 이후 이벤트를 rewrite하기 위해 **반드시 필요**하다 (옵션이 아님).

#### 동작 흐름

Hook 입장:
1. `/sessions/ensure` 호출 시 (`runtimeSource`, `runtimeSessionId`)에서 UUID v5 (SHA-1 name-based)로 **결정적 placeholder ID** 생성:

```ts
export function localEnsureResult(body: unknown): RuntimeSessionEnsureResult {
    const input = isRecord(body) ? body : {};
    const runtimeSource    = ... ;
    const runtimeSessionId = ... ;
    const taskId    = uuidFromSeed(`task:${runtimeSource}:${runtimeSessionId}`);
    const sessionId = uuidFromSeed(`session:${runtimeSource}:${runtimeSessionId}`);
    return {taskId, sessionId, taskCreated: false, sessionCreated: false};
}
```

2. 이 placeholder ID를 **즉시 hook에 반환**해서 후속 이벤트가 그것을 sessionId로 사용하게 함.
3. Daemon에 "이 placeholder로 server에 ensure를 호출해 줘" 메시지를 enqueue하고 즉시 종료.

Daemon (백그라운드):
1. Server에 진짜 `/sessions/ensure` 호출. server는 자체 발급한 sessionId를 응답.
2. **placeholder ↔ server 발급 ID 매핑을 메모리에 기록**:

```ts
// local-daemon-entry.ts
function rememberMapping(message: DaemonMessage, result: unknown): void {
    if (!message.localResult || !isRecord(result)) return;
    const taskId    = result.taskId    as string;
    const sessionId = result.sessionId as string;
    setMapping(message.localResult.sessionId, {
        localTaskId:     message.localResult.taskId,
        localSessionId:  message.localResult.sessionId,
        taskId,         // server가 발급한 진짜 ID
        sessionId,
    });
}
```

3. 이후 hook이 보낸 이벤트가 placeholder sessionId를 들고 오면 daemon이 server-assigned ID로 rewrite:

```ts
function rewriteEventIds(event) {
    const mapping = mappings.get(event.localSessionId);
    if (mapping) return { ...event, sessionId: mapping.sessionId };
    return event;
}
```

이 trick으로 hook은 응답 대기 없이 즉시 종료할 수 있고, ID 정합성은 daemon이 server 응답을 받은 시점부터 보장된다.

#### 미묘한 timing window

placeholder 생성 → 첫 후속 이벤트가 daemon 큐에 도달할 때까지의 **짧은 구간**에서, daemon이 아직 server 응답을 못 받았으면 mapping이 비어 있을 수 있다. 이 경우 `rewriteEventIds`가 mapping을 못 찾고 placeholder 그대로 server에 보낸다. server는 placeholder ID가 자기 DB에 없으니 그 이벤트를 어떻게 처리할지가 운영 관점에서 검증 필요한 부분이다 — 이 문서 작성 시점에는 검증 안 함 (한계로 명시).

실측에서는 hook 호출 간격이 충분히 길고 daemon drain이 빨라서 이 race를 관측하지 못함. burst 트래픽 시나리오에서 재현 필요.

### 4.3 매핑이 메모리에만 있는데 daemon이 죽으면?

- placeholder는 **(`runtimeSource`, `runtimeSessionId`)에 대해 결정적**이라 daemon 재시작 후에도 같은 placeholder가 다시 만들어진다.
- Server idempotency는 **client UUID 기반이 아니라 binding 기반** — 같은 (`runtimeSource`, `runtimeSessionId`) 쌍으로 ensure가 다시 오면, server는 기존 binding의 `monitorSessionId`를 그대로 반환하고 `taskCreated: false / sessionCreated: false`로 응답.
- 따라서 daemon 재시작 후 첫 hook이 다시 ensure를 보내면 server가 같은 진짜 ID를 다시 알려주고, daemon 메모리의 매핑이 복구됨.
- 그 사이 (daemon 죽음 → 재시작 → 첫 ensure 응답까지)에 hook이 보낸 이벤트는 placeholder 그대로 server에 도달 — 위 4.2 마지막의 timing window와 같은 한계.

매핑 캐시 크기 제한 (`MAPPING_CAP = 1024`)도 있어서 메모리 무한 성장 방지. FIFO eviction.

---

## 5. Daemon 라이프사이클 — 언제 시작하고 언제 종료하나

### 5.1 시작
- 첫 hook 호출에서 socket connect 실패 → `maybeStartDaemon` → detached child spawn
- Idempotent: 두 hook이 동시에 시작 시도해도 두 번째는 `probeExistingDaemon`이 true 반환 → 즉시 exit

```ts
const alreadyRunning = await probeExistingDaemon(layout.socketPath);
if (alreadyRunning) {
    process.stderr.write(`[daemon] already running — exiting\n`);
    process.exit(0);
}
```

### 5.2 종료 — idle timeout
```ts
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;   // 5분

const idleTimer = setInterval(() => {
    if (queue.length > 0 || processing) {
        lastActivityAt = Date.now();
        return;
    }
    if (Date.now() - lastActivityAt < IDLE_SHUTDOWN_MS) return;
    void gracefulShutdown("idle-timeout");
}, 30_000);
```

**5분 동안 메시지가 없으면 graceful shutdown**. 이유:
- Claude Code 세션이 끝났는데 daemon이 계속 메모리 잡고 있을 이유 없음
- 다음 세션 시작 시 어차피 첫 hook이 다시 spawn

### 5.3 종료 — signal 처리
```ts
process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.once("SIGINT",  () => void gracefulShutdown("SIGINT"));

async function gracefulShutdown(signal: string): Promise<void> {
    server.close();         // 새 connection 안 받음
    await drain();          // 큐에 남은 메시지 모두 server로 전달
    process.exit(0);
}
```

shutdown 시 **큐에 쌓인 메시지를 마저 처리**. 갑자기 죽이지 않음. 시스템 종료나 user의 ctrl-C에서도 데이터 유실 최소화.

---

## 6. 보안 / 격리

### 6.1 Socket 권한
```ts
fs.chmodSync(layout.socketPath, DAEMON_SOCKET_MODE);  // 0o600
```

Socket 파일을 **owner-only 읽기/쓰기**로 chmod. 같은 머신의 다른 사용자는 못 들어옴 (UDS의 큰 장점 — TCP 포트와 달리 OS user 격리가 자동).

### 6.2 Socket 위치
```ts
const home = env.HOME ?? os.homedir();
const homeDir = path.join(home, DAEMON_HOME_DIRNAME);   // ~/.agent-tracer/
const socketPath = path.join(homeDir, "daemon.sock");
```

`~/.agent-tracer/daemon.sock`. 사용자 home 디렉터리 안. 다른 사용자가 자기 home으로 가면 별도 daemon.

벤치마크에서는 컨테이너별로 격리하기 위해 `AGENT_TRACER_DAEMON_SOCKET=/tmp/agent-tracer-X.sock` 환경변수로 override.

### 6.3 Daemon 모드 격리
```ts
function shouldUseLocalDaemon(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.AGENT_TRACER_DAEMON_CHILD === "1") return false;  // daemon 자신은 자기 자신을 안 거침
    const mode = (env.MONITOR_TRANSPORT ?? "daemon").trim().toLowerCase();
    return mode === "daemon" || mode === "local-daemon" || mode === "uds";
}
```

`MONITOR_TRANSPORT=http`로 켜면 daemon을 우회하고 직접 HTTP. trouble-shooting / fallback 용.

---

## 7. 측정 결과 해석

### 7.1 Phase 3 단독은 -12.5 %로 작은 이유

`node + tsx + UDS daemon`만 봤을 때 (Phase 3 단독):

| 지표 | AS-IS | Phase 3 | Δ |
|---|---:|---:|---:|
| Avg hook p99 | 230.61 ms | 198.98 ms | −13.7 % |
| Mean ± stddev (5 runs) | n/a | 214.95 ± 3.61 | — |
| Memory avg | 67.09 MiB | 131.52 MiB | **+96 %** |

이유:
- Hook의 **bottleneck은 여전히 `node + tsx` cold start** (~200 ms+)
- Daemon이 절약하는 건 transport 비용 (~30 ms 정도)
- Daemon은 메모리에 상주 (132 MiB) — 비용이 얹힘

**Phase 3는 Phase 2와 결합해도 latency를 추가로 줄이지 않음** (다음 §7.2 참조).
cold start floor가 30–40 ms로 낮아진 뒤에는 daemon의 transport 절약 (~2 ms 수준)이
stddev 안에 묻혀버린다.

### 7.2 Phase 2+3 결합 (n=200, median of 5 runs)

| 구성 | Median p99 | Mean ± stddev (n=5) | hook range (min–max p99 across 5 hooks) |
|---|---:|---:|---:|
| Phase 2 best (`bun + JS + HTTP`) | **34.28 ms** | 137.69 ± 8.30 | 20.9–40.8 (~20 ms) |
| Phase 2+3 (`bun + JS + UDS`) | 35.38 ms | 134.24 ± 3.25 | 32.3–40.2 (~8 ms) |

**Median 차이 1.10 ms / Mean 차이 3.45 ms** — 둘 다 stddev (8.30 vs 3.25) 안에 묻혀
**latency에서 통계적으로 구별되지 않음**. 더 두드러지는 변화는 5개 hook의 p99 분포 —
좁은 범위 (40→8 ms)로 모임.

### 7.3 "분포 평탄화"의 정확한 메커니즘 (n=200 재측정)

이 측정에서의 "variance"는 **5개 hook (SessionStart / StatusLine / PreToolUse / UserPromptSubmit / PostToolUse)의 p99이 서로 얼마나 다른가**를 가리킨다 (run-to-run jitter가 아니라 hook-to-hook spread). 측정은 `concurrency=1`이라서 동시 hook burst가 없고, 따라서 "queue burst 흡수"는 이 데이터에서는 일어날 수 없다.

실제로 phase2-bun-js → phase2-3을 비교하면 (n=200 median):

| Hook | phase2-bun-js p99 | phase2-3 p99 | Δ |
|---|---:|---:|---:|
| SessionStart | 40.8 | 40.2 | −0.6 |
| StatusLine | 39.4 | 34.9 | −4.5 |
| PreToolUse | 31.6 | 33.0 | +1.4 |
| UserPromptSubmit | 20.9 | 32.3 | **+11.4** |
| PostToolUse/Bash | 38.8 | 36.4 | −2.4 |

→ **빠른 hook(UserPromptSubmit 21 → 32)은 daemon write floor 때문에 느려지고, 느린/중간 hook은 거의 변화 없거나 약간 빨라짐**. 즉 (n=50 측정과 메커니즘 동일):

- daemon UDS write에 **~10 ms 정도의 floor가 추가**된다 (가장 빠른 UserPromptSubmit이 그만큼 느려짐).
- 다른 hook들은 이미 그 floor 위에 있어서 거의 변화 없음.
- 평균은 비슷하고, 분포가 좁아진다 (5개 hook이 32–40 ms 좁은 범위로 모임).

#### 이 메커니즘에서 무엇이 좋은가

- **사용자 체감 일관성**: 어떤 hook이 호출돼도 비슷한 시간 안에 끝남. SessionStart가 PreToolUse보다 두 배 느린 비대칭이 사라짐.
- **server-side 트래픽 패턴**: hook이 독립 HTTP connect를 매번 새로 만들지 않음 → server connection churn 감소.

#### 이 메커니즘이 깨지는 시나리오 (현재 측정에서는 안 일어남)

- **concurrency > 1 burst**: hook이 동시에 여러 개 떴을 때 daemon이 backpressure로 흡수해서 server queue spike를 줄여 줄 가능성. 가능성은 있지만 **이 문서의 측정은 concurrency=1이라 검증 안 됨**.
- **server 응답이 느려질 때**: HTTP transport는 hook이 server timeout을 그대로 흡수. UDS daemon은 hook이 fire-and-forget이라 server timeout은 daemon만 부담. hook latency는 server 상태와 디커플링됨. 이것도 직접 측정 안 함.

### 7.4 측정의 결론

**단일 사용자 self-hosted 시나리오에서 daemon은 hook latency를 줄이지 않는다**:
- Phase 2 단독 (34.28) ≈ Phase 2+3 (35.38), stddev 안 차이 (1.10 ms median, 3.45 ms mean)
- Phase 3 단독 효과는 -13.7%로 작고 메모리 +96% 추가 비용

그러면 daemon은 왜 쓰는가? 다음 섹션에서 답한다 — **multi-user 시나리오의
사용자별 이벤트 broker 역할**.

---

## 8. Daemon의 진짜 가치 — Multi-user / SaaS 시나리오

이번 측정의 한계는 **모든 컴포넌트(hook, daemon, server)가 같은 머신에
있다**는 것. production 배포 시나리오는 보통 그렇지 않다.

### 8.1 시나리오 A — 단일 사용자 self-hosted (이번 측정)

```
[사용자 노트북]
  ┌─────────┐
  │  hook   │  ┐
  │ process │  ├─ HTTP loopback ─→ ┌────────┐
  │   × M   │  │                    │ server │ → DB
  └─────────┘  │                    └────────┘
       또는    │
  ┌─────────┐  │
  │  hook   │  │
  │ process │  ├─ UDS ─→ daemon ─ HTTP loopback ─→ server
  │   × M   │  │
  └─────────┘  ┘
```

- hook ↔ server: HTTP loopback (~5 ms /sessions/ensure)
- daemon이 절감하는 IPC 비용 자체가 작음 (이미 loopback)
- 결과: **latency 변화 없음, memory +40 MB** — daemon은 손해

### 8.2 시나리오 B — Multi-user / SaaS (이번 측정 안 됨)

```
[사용자 1]                          ┌──────────────┐
  hook × M ─→ daemon₁ ─keep-alive─┐│              │
                                   ├→  원격 server │ → DB
[사용자 2]                          ││  (단일 인스턴스)│
  hook × M ─→ daemon₂ ─keep-alive─┤│              │
                                   ├└──────────────┘
[사용자 N]                          │
  hook × M ─→ daemonₙ ─keep-alive─┘
```

여기서 daemon = **사용자별 이벤트 브로커**. 이 시나리오에서 daemon이
가져오는 server-side 절감:

#### 8.2.1 Connection churn 감소

daemon 없을 때 (hook 직접 server 호출):
- N명 사용자 × M hook/min × T분 = **N×M×T 개의 short-lived connection**
- 매 connection마다 TCP handshake (3-way) + TLS handshake (TLS 1.3 1-RTT
  resumption 안 되면 1.5-RTT)
- server는 매 호출마다 connection accept / setup / close 처리

daemon 있을 때:
- N개의 long-lived keep-alive connection (사용자당 daemon 1개)
- TLS handshake 1회 / daemon 시작 — 그 후 모든 hook 트래픽이 그 위로 흐름
- server는 hot connection만 다룸

**단순 비교**: 1000명 × 10 hook/min × 60분 = 600,000 connection setup vs
1,000 connection setup. 600x 차이.

#### 8.2.2 TLS handshake 비용

production에서는 hook ↔ server는 보통 TLS. TLS 1.3 RTT:
- new connection: 1-RTT (~50–100 ms in WAN)
- session resumption: 0-RTT 가능하지만 처리 비용 있음

daemon 없으면 이 비용이 매 hook 호출마다 발생 (hook은 short-lived라 session 캐시 못 유지). daemon 있으면 사용자당 1회.

#### 8.2.3 Batching / aggregation

daemon이 server에 1:1 forward 대신 100 events/min을 1 batch/min으로 묶어
보내면:
- server RPS 100x 감소
- HTTP framing 비용 100x 감소
- DB write도 batch insert로 더 효율

(현재 daemon은 1:1 forward로 구현. batching은 후속 최적화 후보.)

#### 8.2.4 Server outage 흡수

daemon에 **disk-backed queue**가 있으면 server 일시 다운 시:
- hook은 daemon에 계속 메시지 enqueue → daemon이 queue에 쌓아둠
- server 복구 시 daemon이 backlog drain
- hook 호출 자체는 서버 상태와 무관하게 항상 ~30 ms 안에 끝남

daemon 없으면 server 다운 = hook fail = 사용자가 critical path에서 에러
체감. (현재 daemon은 메모리 큐만 있어 daemon 죽으면 손실 — disk queue는
후속 작업.)

### 8.3 즉, daemon의 가치 = "사용자별 이벤트 브로커"

Self-hosted 시나리오는 N=1이라 위 모든 절감이 N×M = 1×M = M으로 축소되어
효과가 미미. **production multi-user 시나리오에서는 N이 두 자릿수~네
자릿수로 커지면서 daemon의 가치가 본질적이 됨**.

비유하자면 — daemon은 **사용자 머신 위의 작은 message broker (Kafka /
Redis pub-sub의 매우 가벼운 변종)**. 본질적 역할은:
- Producer (hook) ↔ Broker (daemon) 사이 fire-and-forget IPC
- Broker (daemon) ↔ Consumer (server) 사이 amortized batched HTTP
- Server는 N daemon으로부터 받지, N×M hook으로부터 받지 않음

### 8.4 이번 측정의 한계

multi-user 시나리오는 측정 안 함. 다음 measurement round 후보:
- concurrency 4 / 8 / 16 (단일 호스트 burst) — daemon batching 검증
- 다중 호스트에서 단일 server에 부하 — connection churn 검증
- TLS 활성 환경에서 daemon vs no-daemon — handshake 절감 정량화
- daemon disk-backed queue 추가 후 server kill 복구 시간 측정

이 측정들이 가능해지면 Phase 3의 정량적 정당화가 latency 표가 아니라
"server CPU −X%, connection rate −Y%, p99 server-side −Z ms (under
N-user load)" 형태로 나올 것.

---

## 9. Trade-off — daemon이 가져오는 비용

### 9.1 메모리 상주
약 22 MiB (bun) / 140 MiB (node+tsx). hook 호출이 분당 수십 회 이상이면 충분히 정당화. 쓰지 않을 때 5분 idle 후 자동 종료. **단일 사용자 self-hosted에서 latency 우위 없는 상황에서는 이 메모리가 순손해**.

### 9.2 운영 복잡도
- 모니터링: daemon이 죽었는지 alive한지 체크 필요 (현재는 hook이 첫 호출 때 자동 spawn하므로 사실상 self-healing)
- 디버깅: hook 동작이 이상하면 daemon log (`~/.agent-tracer/daemon.log`)도 같이 봐야 함
- 신호 전파: hook이 보낸 이벤트의 server 처리 결과는 daemon log로만 보임 (hook은 이미 exit)

### 9.3 fire-and-forget의 데이터 손실 risk
- 메시지가 daemon에 도착하지 못한 채 hook이 종료될 수 있음 (UDS write 실패 케이스)
- 대응: hook은 UDS write 실패 시 **HTTP fallback**으로 서버 직접 호출
- daemon이 메시지 받았지만 server에 보내기 전에 daemon이 죽으면? → 미해결 risk. 단, hook 이벤트는 observability 데이터라 일부 손실이 critical 하진 않음. 필요하면 disk-backed queue로 확장 가능 (§8.2.4 참조).

### 9.4 한 사용자 / 다중 Claude Code 세션
같은 user에서 Claude Code를 여러 번 띄우면 **동일 daemon을 공유**한다. ID 매핑이 메모리에 1024개 LRU로 관리되므로 세션이 너무 많이 동시에 떠도 일부 세션의 매핑이 evicted될 수 있음. 실제로는 1024개로 충분함 (보통 동시 active 세션 수는 한 자릿수).

---

## 10. 자주 나올 질문에 대한 답변

### Q. "왜 그냥 HTTP keep-alive를 hook 안에서 쓰면 안 되나?"

Hook 자체가 매번 새 프로세스. **프로세스가 죽으면 keep-alive connection도 같이 죽는다**. 다음 hook은 처음부터 다시 connect. Daemon은 long-lived이기 때문에 keep-alive가 의미 있다.

### Q. "shared memory나 D-Bus는 안 쓰나?"

UDS가 가장 단순하고 portable (POSIX 어디서든 동작). Shared memory는 동기화 문제가 복잡. D-Bus는 Linux 위주이고 추가 dependency. Hook이 보내는 메시지는 작고 간헐적이라 UDS의 throughput이 충분.

### Q. "daemon이 망가지면 모든 hook이 멈춘다는 게 아닌가?"

Hook은 UDS write 실패 시 **HTTP transport로 fallback**한다. Daemon이 죽어도 다음 hook이 자동 spawn. `MONITOR_TRANSPORT=http`로 daemon을 완전히 끄는 escape hatch도 있음.

### Q. "결정적 UUID로 ID를 만들면 보안 risk 없나?"

Seed에 입력되는 `runtimeSource`와 `runtimeSessionId`는 사용자가 임의로 만든 값. **외부 공격자가 이 seed를 모르면 같은 UUID를 못 만든다**. UUID v5의 namespace UUID도 우리가 정한 값(`"agent-tracer/v1"`). hash collision 확률은 SHA-1 수준이라 실질적으로 0.

### Q. "daemon이 큐에 쌓아두기만 하면 hook 결과가 server에 늦게 반영되지 않나?"

`drain()`은 **hook 메시지가 들어오자마자** 비동기로 시작. 큐에 메시지가 쌓이는 건 daemon → server HTTP가 느려질 때만이고, 그 경우에도 hook 입장에선 이미 exit한 뒤 일이라 user-facing latency엔 영향 없음. observability 데이터의 server 도착이 약간 지연되는 건 acceptable.

### Q. "왜 newline-delimited JSON인가? Protobuf 같은 binary protocol은?"

이유는 단순함. JSON은 디버깅 (사용자가 socket을 cat 해서 봐도 읽음), 버전 관리 (필드 추가/제거가 자유), 구현 단순. UDS의 throughput은 hook 수준 트래픽에서 binary 직렬화 차이가 안 보임. 메시지가 수만 건/초 수준이 되면 그때 검토.

### Q. "Phase 2 단독 (34.28 ms) 대비 Phase 2+3 (35.38 ms)이 오히려 더 느린데 운영 복잡도를 추가할 가치가 있나?"

**단일 사용자 self-hosted 시나리오에선 솔직히 latency 측면에서는 가치 없음**. n=200 × 5 runs 측정 결과:
- Phase 2 (median): 34.28 ms (mean 137.69 ± 8.30)
- Phase 2+3 (median): 35.38 ms (mean 134.24 ± 3.25)

stddev 안에 묻혀 있는 차이. latency만 본다면 daemon은 손해 (메모리 +40 MB).

**그러나 production multi-user 시나리오에선 본질적**:
- N명 사용자 × M hook/min 트래픽 → daemon 없으면 N×M개 short-lived TCP/TLS handshake가 server에 몰림. daemon 있으면 N개 long-lived keep-alive.
- TLS handshake 비용을 사용자당 1회로 amortize.
- daemon이 1:1 forward 대신 batch (예: 100 events/min → 1 batch/min) → server RPS 절감.
- daemon에 disk-backed queue 추가하면 server outage 흡수 가능.

§8 (Daemon의 진짜 가치) 참조. 즉 **latency 표를 근거로 들어선 안 되고 server-side scalability를 근거로 들어야 한다**. 이번 단일 사용자 측정은 그 근거를 만들 환경이 아님.

---

## 11. 한 줄 요약

> **Hook이 빠르려면 (Phase 2) "프로세스가 가벼워야 하고", N명 사용자가 한 server에 보고하는 production 환경에서 server가 살아남으려면 (Phase 3) 사용자별로 hook 트래픽을 amortize할 broker가 필요하다. UDS daemon은 이 broker의 가장 가벼운 구현이고, 결정적 placeholder + daemon mapping 트릭은 server가 자체 발급한 진짜 ID를 알기 전에도 hook이 일관된 ID로 후속 이벤트를 만들 수 있게 한다. 단일 사용자 self-hosted 측정에서는 daemon이 latency를 줄이지 않지만, multi-user에선 connection churn / TLS handshake / batching이라는 server-side 절감의 단일 지점이 된다.**
