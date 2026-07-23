# agent-tracer-monitor

Claude Code의 실행 기록을 수집해 Agent Tracer 서버로 보내는 플러그인이다. 이 디렉터리가 곧
플러그인 루트이며 마켓플레이스는 `git-subdir`로 이 경로만 클론한다.

## 필요한 것

Node 24. 훅 번들이 Node 24를 대상으로 만들어졌다. 진입 스크립트가 버전을 검사해 낮은 버전에서는
훅이 아무 일도 하지 않고 빠져나가므로, 수집이 통째로 조용히 멈춘다.

수집 대상 서버. 이 플러그인은 이벤트 원장을 소유하지 않는다. 규칙·레시피·AI 작업 등록은 서버가
소유하고 데몬은 이를 받아 적용한다. 다만 이벤트 전송만 담당하지는 않는다. 데몬은 최근 이벤트로
힌트를 직접 계산한다. 규칙 생성 작업은 서버에서 접수하지만, 데몬이 Claude Agent SDK를 로컬에서
실행한다. 따라서 이 플러그인은 모델을 직접 호출하고 토큰을 사용한다.

서버 없이 플러그인만 깔면 훅과 데몬은 뜨지만 이벤트가 `~/.agent-tracer/spool`에 쌓이기만 하고,
스풀이 50MB를 넘으면 오래된 것부터 버린다. `/recipe`와 `/rule`은 요청을 처리할 서버가 없어 결과를
않는다. 실패는 사용자의 작업을 막지 않으므로 겉으로는 잘 도는 것처럼 보인다.

## 서버 띄우기

앱 이미지를 저장소에서 빌드하므로 클론이 필요하다. 도커와 Node 24가 있어야 한다.

```bash
git clone https://github.com/belljun3395/agent-tracer.git
cd agent-tracer
npm run stack:up
```

인프라와 앱이 전부 뜨고 수집 진입점이 `http://127.0.0.1:3847`에 열린다. 대시보드는
`http://127.0.0.1:5173`이다. 내릴 때는 `npm run stack:down`이다.

## 설치

```
/plugin marketplace add belljun3395/agent-tracer
/plugin install agent-tracer-monitor@agent-tracer
```

수집 대상 서버는 `MONITOR_BASE_URL`(또는 `MONITOR_PORT`)로 가리키며 기본값은
`http://127.0.0.1:3847`이다. 서버를 다른 호스트에 띄웠다면 이 환경 변수로 옮긴다.

잘 연결됐는지는 `http://127.0.0.1:3848/`의 데몬 제어 화면에서 본다. 파이프라인이 이벤트를 전송 중이면
연결된 것이고, 스풀만 늘어나면 서버에 닿지 못한 것이다.

## 구성

| 경로 | 역할 |
|---|---|
| `.claude-plugin/plugin.json` | 플러그인 매니페스트. 훅과 데몬의 버전 비교 기준이다 |
| `hooks/hooks.json` | 훅 이벤트 등록. 모든 훅이 `bin/run-hook-claude.sh` 하나로 들어온다 |
| `bin/run-hook-claude.sh` | 훅 진입점. 번들이 있으면 node로 실행하고 없으면 소스를 로더로 띄운다 |
| `commands/` | 터미널에서 데몬에 AI 작업을 요청하는 슬래시 명령(`/recipe` `/rule`) |
| `src/agent/claude-code/hooks/` | 훅 진입점. 훅 이름과 파일 이름이 같다 |
| `src/daemon/main.ts` | 스풀을 전송하고 제어 화면을 제공하는 로컬 데몬 |

## 빌드

```bash
npm run build --workspace @monitor/runtime
```

`dist/agent/claude-code/hooks/<훅이름>.js`와 `dist/daemon/main.js`가 나온다. 설치본에는
`node_modules`가 없으므로 두 산출물 모두 커널까지 포함한 단일 파일이다. 훅 번들은
zod를 포함하지 않으며 의존 그래프 검사가 이 독립 실행 조건을 강제한다.

## 데몬

훅은 매 호출마다 소켓으로 데몬 버전을 확인하고 자기보다 낮으면 데몬을 내린 뒤 최신
버전으로 다시 띄운다. 플러그인을 업데이트해도 수동 재시작이 필요 없다. 데몬은
`http://127.0.0.1:3848/`에서 파이프라인 상태와 개입 기록과 스풀을 보여주는 제어 화면을
제공한다.
