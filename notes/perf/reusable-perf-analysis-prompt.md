# 재사용 가능한 성능 분석 프롬프트

> Agent Tracer 에서 진행한 perf/base + phase 브랜치 + deep-dive 분석을 다른 프로젝트에도 그대로 적용하기 위한 프롬프트. 새 프로젝트에서 Claude 세션을 열고 아래 블록을 그대로 붙여넣으면 동일한 워크플로우로 진행한다.

---

## 사용 방법

1. 분석할 프로젝트의 git repo에서 Claude Code 세션을 시작한다.
2. 아래 "프롬프트 본문" 전체를 복사해서 첫 메시지로 보낸다.
3. Claude가 단계별로 진행하면서 plan 단계에서 한 번 사용자 확인을 받는다 (사용자가 "쭉 진행해" 하면 다음 단계는 자동).
4. 완료 후 `notes/perf/` 아래에 모든 결과물이 정리된 상태가 된다.

---

## 프롬프트 본문 (여기부터 복사)

```
이 프로젝트의 핵심 hot path를 측정 기반으로 분석하고 단계별로 개선해줘.
나는 결과를 이력서/면접에 활용할 거니까 단순한 수치 개선만이 아니라
"왜 빨라졌는가"의 기술 설명까지 함께 만들어줘.

# 워크플로우

## 단계 0 — 프로젝트 이해
먼저 다음을 답해:
- 이 프로젝트는 무엇을 하나 (한 줄 + 3-5줄 설명)
- 사용 기술 스택과 그 선택의 의도 (가능한 한 추측 말고 코드/package.json 근거)
- "사용자가 체감하는 critical path"는 어디인가 (요청 처리, hook, build, …)
- 측정 가능한 "주된 지표" 후보 (latency p99 / throughput / cold start / 메모리 등)

## 단계 1 — 병목 가설
critical path를 1회 무거운 측정 (또는 코드 분석)으로 살펴본 뒤,
"여기를 고치면 가장 큰 효과가 날 것"인 지점 2~4개를 가설로 제시.
각 가설마다:
- 무엇이 비싼가 (구체적인 비용 출처)
- 어떻게 줄일 수 있는가 (구현 후보)
- 예상 개선 폭 (직관 수준이라도 OK)

## 단계 2 — 진행 계획 보고
다음을 정리해서 보고하고 OK를 받는다:
- 베이스 브랜치 이름 (예: `perf/base`) — 공통 측정 인프라가 들어갈 곳
- 각 후보별 phase 브랜치 (예: `perf/phase-X-<name>`)
- 결합 후보가 있으면 별도 phase 브랜치
- 최종 종합 문서 브랜치 (`perf/summary`)
- 측정 방법 (자원 고정 / 반복 횟수 / 중앙값 산정 기준)
- 예상 시간

이 보고가 끝나면 사용자가 "쭉 진행해"라고 승인할 때까지 대기.
이후 단계는 모두 자동으로 진행하되, 공통 수정 사항이 발견되면
perf/base에 반영하고 모든 phase 브랜치를 rebase.

## 단계 3 — perf/base 구축
다음을 한 브랜치에 정리한다 (각 의미 단위로 1 commit):
- 측정 가능한 hot path를 노출시키는 instrumentation (로깅, OTel, 또는 직접 timing)
- 자원 고정 측정 환경 (Docker `--cpus` / `--memory`, 또는 ulimit, 혹은 OS 격리)
- 측정 harness:
  - 단일 phase 실행기 (지정한 작업을 N회 반복하고 p50/p95/p99/max 출력)
  - **3회 자동 실행 + 중앙값 선택기** (avg 지표 기준 정렬, 가운데 run의 artifact 경로 출력)
- AS-IS 베이스라인 측정 + 측정 수치를 기록한 doc (`notes/perf/<project>-baseline.md`)
- 각 phase 측정 결과를 채울 템플릿

이 단계가 끝나면 사용자에게 AS-IS 수치 보고.

## 단계 4 — 각 phase 측정 + 문서화
각 phase 브랜치는 perf/base 위에 정확히 3 commits:
1. `perf(infra/<phase>): ...` — 그 phase를 측정하기 위한 harness 항목 추가만
2. `perf(<phase>): ...` — 실제 개선 코드 (가능한 한 squash해서 단일 commit)
3. `docs(perf/<phase>): ...` — 3회 측정 후 중앙값 run 결과를 채운 문서

각 phase에서:
- 3회 측정 후 avg 지표의 중앙값 run의 artifact를 채택
- 채택한 run의 timestamp 기록 (재현성)
- failures / error 0 검증
- AS-IS 대비 개선율 계산 (% + pp)

진행 도중 공통 수정이 필요하면:
- perf/base에 fix commit 추가
- 모든 phase 브랜치 rebase
- 잊지 말 것: rebase 후 모든 브랜치가 새 perf/base를 ancestor로 갖는지 verify

## 단계 5 — 최선 조합 (있다면)
phase들이 직교적이면 "best phase + 다른 phase"의 결합을 새 브랜치로 측정.
같은 3-commit 구조 (infra / improve / docs).

## 단계 6 — 종합 문서 (별도 브랜치 `perf/summary`)
perf/base에서 fork한 별도 브랜치에 다음 문서들을 commit별로 정리:

### 6.1 phase-summary.md
- AS-IS vs 최종 비교 표
- phase별 누적 기여도
- 측정 환경 명시
- 의사결정 요약 (단순함 / 성능 / 운영 복잡도 trade-off)
- 다른 문서들로의 cross-link

### 6.2 deep-dive 문서들 (각각 별도 commit)
적용된 개선마다 1개씩 작성. 각 문서는 다음을 포함:
- 변경 개요 + 핵심 결과 수치 표
- 분리해야 할 오해 (개념적 함정)
- AS-IS 작동 방식의 단계별 분해 (왜 비싼가)
- TO-BE 작동 방식의 단계별 분해 (무엇이 사라졌나)
- 각 설계 선택의 trade-off
- 측정 결과의 해석
- 자주 받을 질문에 대한 답변
- 한 줄 요약

### 6.3 resume-and-interview.md
- 프로젝트 한 줄 정의 (엘리베이터 피치)
- 기술 스택 선택 이유 (각 라이브러리의 채택 근거 + 구체적 코드 단서)
- 측정 수치 한눈에 보는 표 (AS-IS vs 최종, 단계별 기여도, 신뢰도)
- 이력서 표현 5가지 길이 (한 줄 / 두 줄 / STAR / 시스템 설계 강조 / 키워드만)
- 예상 면접 질문 + 답변 (최소 20개, 카테고리별로):
  - 프로젝트 / 의사결정
  - 각 기술 개선마다 깊은 질문
  - 측정 / 방법론
  - 실패 모드 / 한 단계 더 깊은 질문
- 한 문장 결론 (압축 답변)

## 커밋 / 브랜치 규칙

- 각 phase 브랜치는 정확히 3 commits (infra / improve / docs).
- perf/base는 의미 단위 commit. 시행착오 fix는 작업 끝나고 squash로 정리.
- 공통 수정은 perf/base에 가고, phase 브랜치들은 즉시 rebase.
- 모든 분석 산출물은 `notes/perf/` 아래. (VitePress 등 정적 사이트가 `docs/`를 읽으면 거기 두지 말 것.)
- 측정 artifact는 `observability/results/` 또는 비슷한 디렉터리에 보존.

## 측정 신뢰도 기준

- 동일 자원 제한 (CPU/memory pinning)
- 3-run median (avg 지표 기준 정렬, 가운데 run 채택)
- failures / errors 0 검증
- 측정 시점에 의존성 시스템 살아 있음 verify (서버 / DB / 외부 의존성)
- artifact의 timestamp + git SHA를 doc에 기록

## 시작 전 한 가지

위 워크플로우에서 이 프로젝트에 맞지 않는 부분 있으면 (예: Docker가 없거나,
서버 측정이 의미 없거나, hot path가 다른 형태이거나) 단계 0에서 적응해서
보고해줘. 워크플로우 자체보다 "측정 기반 + 단계별 검증 + 깊이 있는 문서"가
유지되는 게 핵심.
```

(여기까지 복사)

---

## 이 프롬프트가 잘 작동하는 조건

- **git이 있는 repo**: 브랜치 / worktree / rebase가 핵심 도구
- **명확한 hot path**: 사용자가 "어디가 느린지"에 대해 사전 감을 갖고 있어야 함 (없어도 동작하지만 단계 1에서 시간이 더 든다)
- **반복 가능한 측정 환경**: Docker, 또는 그에 준하는 격리 (Linux cgroups, macOS sandbox, etc.). 격리가 없으면 측정 노이즈가 커서 3-run median이 의미 없어진다.
- **시간 여유**: phase 1개당 측정 ~25분 (build 포함). 5개 phase면 약 2시간 + 문서.

## 잘 작동하지 않는 경우

- **순수 알고리즘 최적화** — 자료구조 / 시간복잡도가 본질인 문제는 이 워크플로우보다 직접 분석이 빠르다.
- **분산 시스템의 tail-latency 분석** — 단일 머신 Docker 격리로는 충분히 재현 안 되는 영역. real production traffic이 필요.
- **hot path가 외부 의존성** (예: 외부 API rate limit) — 우리 코드를 고쳐서 줄이는 게 아니라 의존성을 바꿔야 하는 문제.

## 변형 — 빠른 1회 분석만 필요한 경우

위 프롬프트의 "단계 4 phase별 3-commit" 부분을 빼고 "단계 6 종합 문서"만
간략화해서 사용. 이 경우 phase는 1개로 두고 직접 측정 → 문서로 끝낸다.

## 변형 — 기존 분석에 deep-dive만 추가하는 경우

이미 phase 측정이 끝난 repo에서 deep-dive 문서만 새로 쓸 때:

```
이 repo의 perf/* 브랜치에서 진행한 성능 개선을 보고,
각 개선마다 다음 항목으로 deep-dive 문서를 notes/perf/ 아래에 만들어줘.
이력서/면접에 쓸 거니까 "왜 빨라졌는가"의 기술 설명을 깊이 있게.

각 deep-dive는 별도 commit, 다음 구조로:
- 변경 개요 + 핵심 결과 수치 표
- 분리해야 할 개념적 오해
- AS-IS 단계별 분해
- TO-BE 단계별 분해
- 설계 선택의 trade-off
- 자주 받을 질문에 대한 답변
- 한 줄 요약

마지막에 resume-and-interview.md (이력서 표현 5가지 + 면접 질문 20+개 + 답변)도
별도 commit으로.
```

## 자체 점검 — Agent Tracer에서 잘 됐는가

| 기준 | Agent Tracer에서 어땠나 |
|---|---|
| 단계 0 — 프로젝트 이해 | ✓ NestJS / TypeORM / React / OTel 스택 확인 |
| 단계 1 — 병목 가설 | ✓ tsx 런타임 transpile / HTTP transport / 컴파일 부재 3가지 |
| 단계 2 — plan 보고 후 승인 | ✓ "옵션 A로 해줘" |
| 단계 3 — perf/base 구축 | ✓ Docker pinning, n-run runner, AS-IS 229.67 ms (n=200 × 5 runs) |
| 단계 4 — phase별 측정 + 문서 | ✓ 5개 phase, 각각 3 commits |
| 단계 5 — best 결합 | ✓ phase2-bun-js (단일 사용자 best, -85.4 %); Phase 2+3는 multi-user 시 의미 |
| 단계 6 — 종합 문서 | ✓ phase-summary + 3 deep-dive + resume/interview + honest-review |
| 추가 — 재측정 round | ✓ n=50 × 3 → n=200 × 5로 sample 확대해 Phase 2+3 노이즈 가설 검증 |
| 추가 — narrative 정정 | ✓ 시니어 review 받고 모든 narrative를 측정 한계 안으로 끌어들임 |

총 commit 수:
- perf/base: ~6 commits (server / obs / bench / docs / N-runs runner / re-baseline)
- 5개 phase 브랜치 × 3 commits = 15 commits
- perf/summary: 16+ commits (summary + 3 deep-dive + resume + honest-review + cross-link + n=200 refresh)

이 패턴을 다른 프로젝트에서 그대로 재현하기 위한 프롬프트가 위의 본문이다.

**중요한 lesson learned**: 첫 측정 (n=50 × 3 runs)에서 결론을 너무 강하게 만들지 말 것.
Agent Tracer의 경우 첫 round에서 "Phase 2+3가 phase2-bun-js보다 1.8 ms 빨라서 권장"이라고
적었지만 n=200 × 5 runs로 재측정하니 두 구성이 통계적으로 구별되지 않음이 확인됐다.
narrative를 만들 때 stddev를 계산해서 차이가 그 안에 묻혀 있는지를 항상 검증할 것.
