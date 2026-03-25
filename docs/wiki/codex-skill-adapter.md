# Codex Skill Adapter

Codex 통합은 native hook이 아니라 skill + MCP 조합으로 구현된다.
즉, 자동 관찰보다는 "어떤 이벤트를 언제 남길지"를 스킬 지침으로 명시하는 방식이다.

## 핵심 파일

- `skills/codex-monitor/SKILL.md`
- `.agents/skills/codex-monitor/SKILL.md`
- `docs/guide/codex-setup.md`
- `scripts/sync-skill-projections.mjs`
- `AGENTS.md`

## 기본 흐름

1. Codex가 repo-local `codex-monitor` 스킬을 읽는다.
2. turn 시작 시 `monitor_runtime_session_ensure`를 호출한다.
3. `monitor_user_message`로 실제 사용자 요청을 기록한다.
4. 탐색, 계획, 터미널, 주요 도구 사용을 `monitor_*` 도구로 남긴다.
5. final answer 직전에 `monitor_assistant_response`를 남긴다.
6. turn 종료 시 `monitor_runtime_session_end`를 호출한다.

## 이 경로의 특징

- task 범위는 기본적으로 "같은 Codex thread/topic"이다.
- `runtimeSessionId`를 재사용해 같은 thread의 follow-up turn을 하나의 task에 이어 붙인다.
- 자동 tool observation이 없으므로 어떤 도구를 기록할지 지침 품질이 중요하다.
- monitor server가 죽어 있어도 작업은 계속하고, 마지막에 gap report로 처리하는 정책이 기본이다.

## skill source와 projection

수정해야 하는 실제 source는 `skills/codex-monitor/SKILL.md`다.
Codex가 읽는 경로는 `.agents/skills/codex-monitor/SKILL.md`이므로,
스킬 문구를 바꾼 뒤에는 `npm run sync:skills`가 필요하다.

## 현재 코드/문서 기준 포인트

- raw user prompt는 `monitor_user_message`로 수동 기록한다.
- final answer는 `monitor_assistant_response`로 직접 남긴다.
- workflow library search와 evaluation도 스킬 지침 안에서 운영된다.
- `docs/guide/codex-setup.md`는 외부 프로젝트에 `AGENTS.md` managed block과
  skill projection을 심는 경로까지 설명한다.

## 장점과 한계

장점:

- 동작이 명시적이라 디버깅이 쉽다.
- 다른 런타임에서 놓치는 custom planning event를 적극적으로 남길 수 있다.

한계:

- automatic hook 수준의 관찰 범위는 없다.
- skill이 로드되지 않거나 projection이 오래되면 기록 품질이 바로 떨어진다.

## 관련 문서

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
