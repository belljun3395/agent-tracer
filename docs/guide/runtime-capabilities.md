# Agent Tracer - Runtime Capabilities

`packages/core/src/runtime-capabilities.ts` 는 런타임 어댑터별 관찰 가능 범위와
세션 종료 정책을 정의하는 단일 source-of-truth 입니다. 아래 표는 현재 코드의
값을 그대로 요약한 것입니다.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Separate event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|----------------------|----------------------|
| `claude-plugin` | Yes (`UserPromptSubmit`) | Yes | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |

참고: 서버 API 스키마의 `runtimeSource`는 forward-compatibility를 위해 문자열(`z.string`)로 열려 있다.
위 표는 "현재 내장 capability registry에 등록된 adapter" 목록이다.

정책 요약:

- Claude plugin 은 raw prompt 를 캡처하지만 세션 종료 시 primary task 를 자동 완료하지 않는다.
- `claude-hook` 문자열은 과거 데이터 호환을 위한 alias 로만 남아 있고, 문서와 신규 이벤트의 canonical runtimeSource 는 `claude-plugin` 이다.
- 수동 HTTP/MCP 클라이언트는 capability registry 에 내장 어댑터로 등록되어 있지 않지만, 서버 API 자체는 그대로 사용할 수 있다.
