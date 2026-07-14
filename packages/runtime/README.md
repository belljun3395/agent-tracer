# agent-tracer-monitor

Claude Code의 활동을 수집해 Agent Tracer 서버로 보내는 플러그인이다. 이 디렉터리가 곧
플러그인 루트이며 마켓플레이스는 `git-subdir`로 이 경로만 클론한다.

## 설치

```
/plugin marketplace add belljun3395/agent-tracer
/plugin install agent-tracer-monitor@agent-tracer
```

수집 대상 서버는 `MONITOR_BASE_URL`(또는 `MONITOR_PORT`)로 가리키며 기본값은
`http://127.0.0.1:3847`이다.

## 구성

| 경로 | 역할 |
|---|---|
| `.claude-plugin/plugin.json` | 플러그인 매니페스트. 훅과 데몬의 버전 비교 기준이다 |
| `hooks/hooks.json` | 훅 이벤트 등록. 모든 훅이 `bin/run-hook-claude.sh` 하나로 들어온다 |
| `bin/run-hook-claude.sh` | 훅 진입점. 번들이 있으면 node로 실행하고 없으면 소스를 로더로 띄운다 |
| `commands/` | 터미널에서 데몬에 잡을 요청하는 슬래시 커맨드(`/recipe` `/rule`) |
| `src/agent/claude-code/hooks/` | 훅 엔트리. 훅 이름과 파일 이름이 같다 |
| `src/daemon/main.ts` | 스풀을 배출하고 제어 화면을 서빙하는 로컬 데몬 |

## 빌드

```bash
npm run build --workspace @monitor/runtime
```

`dist/agent/claude-code/hooks/<훅이름>.js`와 `dist/daemon/main.js`가 나온다. 설치본에는
`node_modules`가 없으므로 두 산출물 모두 커널까지 인라인한 단일 파일이다. 훅 번들은
zod를 지지 않으며 이 자립성은 의존 그래프 검사기가 집행한다.

## 데몬

훅은 매 호출마다 소켓으로 데몬 버전을 확인하고 자기보다 낮으면 데몬을 내린 뒤 최신
버전으로 다시 띄운다. 플러그인을 업데이트해도 수동 재시작이 필요 없다. 데몬은
`http://127.0.0.1:3848/`에 파이프라인 상태와 개입 기록과 스풀을 보여주는 제어 화면을
서빙한다.
