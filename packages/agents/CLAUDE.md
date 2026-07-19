# packages/agents: Python LangGraph 에이전트 서비스

AI 잡 에이전트 3종(recipe-scan·title-suggestion·task-cleanup)을 실행하는 Python 실행 백엔드.
TS 모노레포 도구(tsc·eslint·dep-cruiser·knip) 대상 밖(`packages/*` 아님)이라 자체 도구로 검증한다.

## 검증 루프 (작업 완료 전 필수)

```bash
.venv/bin/ruff check src tests scripts && \
  .venv/bin/mypy src scripts && \
  .venv/bin/python scripts/check_comments.py src tests scripts && \
  .venv/bin/python scripts/check_internal_dependencies.py src && \
  .venv/bin/python -m pytest -q
```

- Python >= 3.12, uv로 의존성 관리. 테스트는 네트워크 없이 페이크 모델(`tests/fakes.py`)로 돈다.
- mypy는 strict 설정을 적용한다.

## 주석 형식

- 모듈·클래스·공개 함수·공개 메서드의 외부 책임은 한글 docstring 한 문장으로 적는다.
- 구현 내부에서 코드로 표현할 수 없는 외부 사실만 `#` 주석으로 적는다.
- HTTP 스키마 필드의 외부 의미는 Pydantic `Field(description=...)`에 둔다.
- 분기·검증·실패 처리 같은 동작은 코드와 테스트가 소유하며, 삼중 따옴표를 블록 주석으로 쓰지 않는다.

## 구조

- `agents/{recipe_scan,task_cleanup,title_suggestion}`: agent·graph·nodes·evidence·policy·models·prompts·tools를
  한 수직 슬라이스로 묶는다. agent는 실행 의존성 조립, graph는 위상, nodes는 변경 이유별 실행,
  evidence는 컨텍스트와 도구 단계, policy는 검증과 조건부 분기를 소유한다. 한 에이전트의 노드나
  프롬프트를 다른 에이전트와 공유하지 않는다. models·prompts는 agent·graph·nodes·tools를 참조하지 않는다.
- `agents/shared/models.py`: 공통 실행 envelope·응답·사용량·step·callback 계약.
  에이전트별 요청과 내부 상태는 각 슬라이스의 `models.py`가 소유한다.
- `agents/runtime/execution`: 에이전트 등록·그래프 실행·실행 궤적·노드 관측을 소유한다.
- `agents/runtime/llm`: 모델 클라이언트 생성·메시지 해석·구조화 호출과 예산 집행을 소유한다.
- `agents/runtime/telemetry`: callback·전파·span·metric 등 관측 실행 기계를 소유한다.
  telemetry는 관측 대상인 execution·llm을 역참조하지 않는다.
- `agents/runtime/ledger.py`: 원장 연결 풀의 수명만 소유한다. 질의문과 사용자 범위는 모르며,
  무엇을 어떻게 읽을지는 각 에이전트 슬라이스의 조회 진입점이 자기 것으로 갖는다.
- `agents/runtime`: 위 실행 기계와 오류 정규화·데드라인·취소·직렬화만 공유한다.
- app은 agent별 슬라이스·runtime·shared를 조립하고, agent별 슬라이스는 runtime/shared만
  참조한다. runtime은 shared만 참조하며 agent끼리 직접 import하지 않는다.
  `scripts/check_internal_dependencies.py`가 이 방향을 CI에서 검사한다.
  저장용 `costUsd` 환산은 ai-agent-worker가 소유한다.

## 계약 불변식

- 원장은 **읽기 전용 뷰로만** 읽는다. 기반 테이블에는 권한이 없어 계약 밖의 열과 모든 쓰기를
  데이터베이스가 거부한다. 사용자 범위는 조회를 부를 때 인자로 넘기지 않고 조회 진입점을 만들
  때 묶으며, 범위가 묶이지 않은 진입점을 슬라이스 밖으로 노출하지 않는다. 아직 전환되지 않은
  에이전트만 요청 본문의 `toolCallback`으로 ai-agent-worker를 되불러 조회한다.
- 취소 레지스트리와 멱등 캐시는 프로세스 로컬 상태라 인스턴스 사이에 공유되지 않는다.
  인스턴스를 늘리려면 이 둘을 먼저 밖으로 빼야 한다.
- 실행은 **접수와 배달이 분리**된다. 요청은 202로 접수만 하고 결과는 `completionCallback`으로
  배달한다. 유료 실행이 HTTP 연결의 수명에 매이면 안 된다.
- 오류는 `error.subtype`으로 노출한다. 문자열 목록은 ai-agent-worker `retry.policy.ts`가 소유하니,
  서브타입 이름을 바꾸면 그쪽 화이트리스트와 함께 고쳐야 한다.
- 세 에이전트의 프롬프트·중간 스키마·agent-facing 도구 설명·그래프·내부 한도는 이 서비스가
  소유한다. ai-agent-worker는 실행 envelope와 데이터 capability만 전달하고 외부 DTO를 재검증한다.
- 워커와 같아야 하는 사실(도구 인자·출력 스키마·예산·합격 기준)은 커널의 계약 픽스처가 소유하고
  `tests/test_*_tool_contract.py`가 그 파일을 읽어 검사한다. 상수를 손으로 맞추지 않는다.
- 그래프 노드·분기·검증 이벤트는 `steps`로 반환한다. 이벤트 어휘를 바꾸면 contracts와 저장·조회
  경계를 함께 고쳐야 한다.
