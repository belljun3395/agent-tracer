# langgraph-agents

AI 잡 에이전트 3종을 **Python LangGraph**로 실행하는 사이드카 서비스.
`packages/server/apps/temporal-worker`의 `generate*` 활동이 HTTP로 호출한다.

Temporal 오케스트레이션(잡 생명주기·재시도 분류·영속)은 temporal-worker(TS)가 소유하고,
이 서비스는 세 에이전트의 프롬프트·중간 구조화 스키마·agent-facing 도구 정책·LangGraph 노드와
분기를 직접 소유한다. temporal-worker는 실행 envelope와 데이터 capability만 전달하고 최종 외부
DTO를 검증·저장한다.

## 다른 백엔드와 비교

같은 에이전트의 SDK 구현도 `temporal-worker`에 함께 존재한다. `claude-sdk`는 워커가
Agent SDK 하위 프로세스를 직접 기동하고, `openai-sdk`는 워커 프로세스 안에서 실행한다.
`worker.entry`가 모든 구현을 registry로 조립하고, `AGENT_BACKEND`(기본 `python`) 또는 잡 입력
`agentBackend`로 백엔드를 고른다. `AGENT_BACKEND=ts`는 `claude-sdk`와 호환된다. SDK 두 구현은
같은 TS `AgentSpec`을 공유하지만 Python 구현은 의도적으로 독립된 에이전트다. 비교 대상은
prompt byte가 아니라 최종 DTO·성공률·근거 정확도·도구 호출·비용·지연이다.

## 에이전트

| 엔드포인트 | 그래프 | 도구 | 출력 |
|---|---|---|---|
| `POST /agents/title-suggestion` | 컨텍스트 판정 → 선택적 수집 → 합성 → 검증/수정 | 태스크 이벤트 조회 | 제목 후보 목록 |
| `POST /agents/task-cleanup` | 후보 배치 순회 → 조사 계획/수집 → 판정 → 검증/수정 | 정리 후보·태스크 이벤트 조회 | 정리 제안 목록 |
| `POST /agents/recipe-scan` | 앵커 → 계획 → 수집 → 충분성 → 합성 → 검증/수정 | 태스크·룰·기존 레시피 조회 | 레시피 후보 목록 |

각 에이전트는 전용 그래프를 쓰며 노드가 사용할 도구와 반복 한도를 결정한다. 데이터 조회는
`toolCallback`으로 실행하며, 사용자 권한과 저장소를 아는 핸들러는 temporal-worker가 소유한다.
모든 그래프의 노드·분기·검증 이벤트는 응답 `steps`에 포함되어 attempt별로 저장된다.

- `GET /health`: 헬스체크.
- `POST /agents/runs/{run_id}/cancel`: 진행 중 실행 취소.

오류는 HTTP 실패가 아니라 응답 본문 `error.subtype`으로 돌려준다. 호출부(temporal-worker)가
Anthropic이 준 오류 타입(`authentication_error` 등)으로 재시도 여부를 판단하게 하기 위함이다.

## 개발

```bash
uv venv --python 3.12
uv pip install -e ".[dev]"

.venv/bin/ruff check src tests scripts  # 린트
.venv/bin/mypy src scripts              # 타입 검사(strict)
.venv/bin/python scripts/check_comments.py src tests scripts  # 주석 규칙 검사
.venv/bin/python scripts/check_internal_dependencies.py src  # 내부 의존 방향 검사
.venv/bin/python -m pytest -q       # 유닛 테스트(네트워크 없음, 페이크 모델)

python -m agent_graph               # 로컬 기동(기본 :8800)
```

## 설정 (환경변수)

| 키 | 기본값 | 용도 |
|---|---|---|
| `AGENT_GRAPH_HOST` / `AGENT_GRAPH_PORT` | `0.0.0.0` / `8800` | 서비스 바인딩 |

설정은 바인딩 주소가 전부다. 이 서비스는 무상태라 DB·OpenSearch에 직접 접속하지 않는다.
에이전트 도구의 데이터 조회는 요청 본문 `toolCallback`(URL+토큰)으로 temporal-worker를
되불러서만 이뤄지고, 소유 스코프는 그 토큰이 정한다.

Anthropic API 키는 **요청 본문 `apiKey`로만** 받는다(환경변수 폴백 없음). 호출부(temporal-worker)가
DB(app_settings)에 등록된 키를 실어 보내며, 키가 없으면 서비스는 422로 거부한다.

## 의도적 단순화

- **모델 폴백 없음**: 모델 불가용성은 Temporal 재시도가 흡수한다.
- **비용 제어**: `agents/runtime/pricing.py`는 그래프 내부 예산 상한을 집행하는 근사치만 계산한다.
  저장하는 `costUsd`는 temporal-worker가 사이드카의 토큰 사용량을 단가로 환산한다.
