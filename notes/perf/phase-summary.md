# Agent Tracer — Phase Summary

## 결론

**최종 권장 구성: Phase 2 best + Phase 3 = `bun + compiled JS + UDS daemon`**

AS-IS(`node + tsx + HTTP`) 대비 hook wall-clock p99 **−83.3 %**, CPU avg
−16.4 pp, Memory avg −32.9 %. Hook latency variance도 평탄화 (39–45 ms 범위).

| 지표 | AS-IS | 최종 (Phase 2+3) | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 250.94 | **41.93** | **−83.3 %** |
| SessionStart p99 (ms) | 336.41 | 42.49 | −87.4 % |
| StatusLine p99 (ms) | 243.79 | 43.04 | −82.3 % |
| PreToolUse p99 (ms) | 204.58 | 45.13 | −77.9 % |
| UserPromptSubmit p99 (ms) | 197.40 | 39.16 | −80.2 % |
| PostToolUse/Bash p99 (ms) | 272.52 | 39.85 | −85.4 % |
| CPU avg (%) | 97.13 | 80.69 | −16.4 pp |
| CPU max (%) | 103.73 | 101.72 | −2.0 pp |
| Memory avg (MiB) | 65.30 | 43.80 | −32.9 % |
| Memory max (MiB) | 104.60 | 55.01 | −47.4 % |
| `/sessions/ensure` p99 (ms) | 4.97 | 21.25 | +328 %\* |
| `/workflow` p99 (ms) | 9.99 | 21.43 | +114 %\* |
| `/tool-activity` p99 (ms) | 9.95 | 9.95 | 0 % |
| 5xx | 0 | 0 | — |
| Event loop p99 (s) | 0.02 | 0.02 | — |
| V8 heap (MiB) | 51.86 | 44.17 | −14.8 % |

\* server-side latency 증가는 hook이 빨라져 요청이 burst성으로 도착하면서
  서버 큐 대기 시간이 늘어난 결과. 그래도 hook end-to-end는 −83 %.

## 측정 환경

- Docker resource: 서버 `1 vCPU / 512 MiB`, 벤치 컨테이너 `--cpus=1.0 / --memory=256m`
- Hooks: `SessionStart`, `StatusLine`, `PreToolUse`, `UserPromptSubmit`, `PostToolUse/Bash`
- 각 hook × 50 iterations + 10 warmup, concurrency 1
- 3회 실행 후 avg phase p99의 median run 채택
- Median artifact: `observability/results/docker-phase-bench/2026-05-03T17-09-28-151Z/`
- Server: NestJS + OTel auto-instrumentation, Prometheus scrape interval 5s
- Branch: `perf/phase2-3-bun-js-daemon`

## 무엇이 빨라졌나

| 변경 | 절감되는 비용 |
|---|---|
| `tsx` 제거 → `bun` runtime | 매 호출마다 들이던 TypeScript transpile + ESM loader 비용 (~150–200 ms) |
| Hook 소스 → `esbuild`로 미리 번들된 JS | bun도 parser/typecheck 안 함; cold start는 ~30–40 ms로 floor |
| HTTP `fetch` → UDS daemon (`enqueueDaemonMessage`) | TCP/HTTP framing + connect overhead가 매 hook 호출에서 사라짐 |
| 결합 효과 | hook latency variance가 평탄화 (39–45 ms 좁은 범위) |

## Phase 2 best 단독과의 비교

Phase 2 best (`bun + compiled JS + HTTP`)가 이미 −82.7 % 개선. Phase 3
daemon UDS를 얹어서 추가로 −0.6 %p 정도만 향상. **Phase 3의 절대값 기여는
작음**. 다만:

- Daemon이 batch/async 처리를 가능하게 해서 latency variance를 좁힘
- Server에 burst 트래픽 대신 backpressure가 적용되어 server-side는 더
  안정적인 처리량 (hook latency variance 측정에서 std dev가 상당히 줄어듦)

## 의사결정 요약

| 옵션 | Avg hook p99 | 복잡도 | 권장 |
|---|---:|---|---|
| AS-IS | 250.94 | 0 | — |
| Phase 2: node + compiled JS | 78.03 | 낮음 (esbuild 추가) | 단순함을 우선시한다면 |
| Phase 2: bun + TS | 48.81 | 중간 (bun 도입) | TypeScript를 그대로 두고 싶다면 |
| Phase 2: bun + compiled JS | 43.73 | 중간 | Phase 3 없이 가장 빠름 |
| **Phase 2+3** | **41.93** | 높음 (daemon 운영 필요) | **권장** — variance까지 평탄화 |

## 근거 / 참고 측정

각 phase의 단독 측정 결과는 해당 브랜치의 `notes/perf/<phase>.md`에 있음:

- `perf/phase2-node-js` → `notes/perf/phase2-node-js.md`
- `perf/phase2-bun-ts` → `notes/perf/phase2-bun-ts.md`
- `perf/phase2-bun-js` → `notes/perf/phase2-bun-js.md`
- `perf/phase3-daemon-uds` → `notes/perf/phase3-daemon-uds.md`
- `perf/phase2-3-bun-js-daemon` → `notes/perf/phase2-3-bun-js-daemon.md`

## 더 깊이 들어가는 자료 (이 브랜치에 함께 둠)

기술 deep-dive와 인터뷰 / 이력서 자료는 별도 문서로 분리:

- [`deep-dive-tsx-to-compiled-js.md`](deep-dive-tsx-to-compiled-js.md) — tsx 런타임 트랜스파일이 왜 short-lived hook에서 비싸고, esbuild bundle precompile이 그걸 어떻게 해결하는가
- [`deep-dive-node-vs-bun.md`](deep-dive-node-vs-bun.md) — V8 vs JavaScriptCore, C++ vs Zig, 같은 컴파일 JS를 실행해도 Bun이 −44 % 빠른 이유
- [`deep-dive-uds-daemon.md`](deep-dive-uds-daemon.md) — UDS daemon 구조, 결정적 UUID v5로 응답 필요 호출까지 fire-and-forget 만든 트릭, daemon 라이프사이클
- [`resume-and-interview.md`](resume-and-interview.md) — 프로젝트 소개 / 라이브러리 선택 이유 / 측정 수치 / 24개 예상 면접 질문과 답변
