# agents

AI 잡 에이전트 3종을 **Python LangGraph**로 실행하는 실행 백엔드.
`packages/server/apps/ai-agent-worker`의 `generate*` 활동이 HTTP로 호출한다.

Temporal 오케스트레이션(잡 생명주기·재시도 분류·영속)은 ai-agent-worker(TS)가 소유하고,
이 서비스는 세 에이전트의 프롬프트·중간 구조화 스키마·agent-facing 도구 정책·LangGraph 노드와
분기를 직접 소유한다. ai-agent-worker는 실행 envelope와 데이터 capability만 전달하고 최종 외부
DTO를 검증·저장한다.

## 다른 백엔드와 비교

같은 에이전트의 SDK 구현도 `ai-agent-worker`에 함께 존재한다. `claude-sdk`는 워커가 Agent SDK
하위 프로세스를 직접 기동한다. 백엔드는 `python`과 `claude-sdk` 둘뿐이고, 워커가 둘을 registry로
조립해 `AGENT_BACKEND`(기본 `python`) 또는 잡 입력 `agentBackend`로 고른다. `AGENT_BACKEND=ts`는
`claude-sdk`의 별칭이다. `claude-sdk` 구현은 TS `AgentSpec`을 쓰지만 Python 구현은 의도적으로
독립된 에이전트다. 비교 대상은 prompt byte가 아니라 최종 DTO·성공률·근거 정확도·도구 호출·비용·지연이다.

## 에이전트

| 엔드포인트 | 도구 | 출력 |
|---|---|---|
| `POST /agents/title-suggestion` | 태스크 이벤트 조회 | 제목 후보 목록 |
| `POST /agents/task-cleanup` | 정리 후보·태스크 이벤트 조회 | 정리 제안 목록 |
| `POST /agents/recipe-scan` | 태스크·룰·기존 레시피 조회 | 레시피 후보 목록 |

셋은 같은 위상을 쓴다. `investigate` → 검증(`validate_candidate` 또는 `validate_decisions`) →
`repair`(검증으로 되돌아간다) → `finalize` 또는 `empty`다. 수리는 한 번만 시도하고, 그래도 검증을
통과하지 못하면 `empty`로 끝난다. 슬라이스마다 다른 것은 위상이 아니라 프롬프트와 도구와
검증 규칙이다. 데이터 조회는 읽기 모델의 `agent_*_view`를 직접 질의하며, 모든 질의가
`user_id`를 조건에 실어 소유 범위를 스스로 지킨다.

- `GET /health`: 헬스체크.
- `POST /agents/runs/{run_id}/cancel`: 진행 중 실행 취소.

## 실행 계약

세 엔드포인트는 실행을 접수만 하고 202로 즉시 답한다(`{"status":"accepted","runId":...}`). 결과는
요청 본문의 `completionCallback`(URL+토큰, 필수)으로 따로 배달된다. 오래 걸리는 유료 실행이 HTTP
연결의 수명에 매이지 않게 하기 위함이다.

완료 창구로 가는 본문이 `data`·`error`·`steps`·`usage`를 담는다. 모든 그래프의 노드·분기·검증
이벤트는 그 `steps`에 실려 attempt별로 저장된다.

오류도 HTTP 실패가 아니라 그 본문의 `error.subtype`으로 돌려준다. 호출부(ai-agent-worker)가
Anthropic이 준 오류 타입(`authentication_error` 등)으로 재시도 여부를 판단하게 하기 위함이다.

## 개발

```bash
uv venv --python 3.12
uv pip install -e ".[dev]"

.venv/bin/ruff check src tests scripts  # 린트
.venv/bin/mypy src scripts              # 타입 검사(strict)
.venv/bin/python scripts/check_comments.py src tests scripts  # 주석 규칙 검사
.venv/bin/python scripts/check_internal_dependencies.py src  # 내부 의존 방향 검사
.venv/bin/python scripts/evaluate_title_quality.py  # 체크인한 품질 기준선(네트워크 없음)
.venv/bin/python -m pytest -q       # 유닛 테스트(네트워크 없음, 페이크 모델)

python -m agent_graph               # 로컬 기동(기본 :8800)
```

실제 모델 실행을 LangSmith에 기록한 뒤 같은 결정적 평가기를 적용하려면
`LANGSMITH_API_KEY=... .venv/bin/python scripts/evaluate_title_quality.py --langsmith-experiment <실험>`을
명시적으로 실행한다. 기본 평가와 CI는 네트워크를 사용하지 않는다.

## 설정 (환경변수)

| 키 | 기본값 | 용도 |
|---|---|---|
| `AGENT_GRAPH_HOST` / `AGENT_GRAPH_PORT` | `0.0.0.0` / `8800` | 서비스 바인딩 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 없음 | 없으면 관측을 끈 채 뜬다 |
| `OTEL_SDK_DISABLED` | 없음 | `true`면 엔드포인트가 있어도 관측을 끈다 |
| `OTEL_SERVICE_NAME` | `agents` | 스팬에 붙는 서비스 이름 |

이 서비스는 읽기 모델에 직접 접속한다. 에이전트 도구의 데이터 조회는 `agent_*_view` 뷰만
질의하며, 원장 테이블과 OpenSearch에는 닿지 않는다. 소유 스코프는 모든 질의에 실리는
`user_id` 조건이 정한다.

다만 프로세스 안에는 상태가 있다. 취소를 걸 수 있게 진행 중 실행을 등록해 두고, 같은 요청이
다시 오면 재실행하지 않도록 멱등 캐시를 5분간 들고 있다. 둘 다 프로세스 로컬이라 인스턴스를
늘리면 공유되지 않는다.

Anthropic API 키는 **요청 본문 `apiKey`로만** 받는다(환경변수 폴백 없음). 호출부(ai-agent-worker)가
DB(app_settings)에 등록된 키를 실어 보내며, 키가 없으면 서비스는 422로 거부한다.

## 의도적 단순화

- **모델 폴백 없음**: 모델 불가용성은 Temporal 재시도가 흡수한다.
- **비용 제어**: `agents/runtime/pricing.py`는 그래프 내부 예산 상한을 집행하는 근사치만 계산한다.
  저장하는 `costUsd`는 ai-agent-worker가 실행 백엔드의 토큰 사용량을 단가로 환산한다.
