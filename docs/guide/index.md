# Setup Guides

Practical setup guides for Agent Tracer. If you want to understand how
the code is organised instead of how to install it, go to the
[codebase wiki](/wiki/).

## Quick start (Claude Code plugin)

Agent Tracer는 Claude Code **plugin** 방식의 설치를 권장합니다.
Plugin은 모든 hook 이벤트를 자동 등록하고, monitor 서버로 이벤트를
전송합니다. 별도 hook 파일 복사나 수동 설정이 필요 없습니다.

### 최소 설치 경로

1. **[Install and Run](./install-and-run.md)** — 저장소 clone, 의존성
   설치, monitor 서버 + 대시보드 기동, 설치 확인.
2. **[Claude Code Setup](./claude-setup.md)** — plugin 로드 +
   MCP 서버 등록. 이 한 페이지로 Claude Code 연동이 완료됩니다.

### 외부 프로젝트에 붙이기 (선택)

Agent Tracer 저장소 바깥의 프로젝트에서 사용하려면 추가 단계가
있습니다.

3. **[External Project Setup](./external-setup.md)** — `npm run
   setup:external`로 대상 프로젝트의 `.claude/settings.json`을
   생성하고, `--plugin-dir` 경로를 확인합니다.

> **참고:** Agent Tracer 저장소 안에서 Claude Code를 실행하는 경우
> `setup:external`은 필요 없습니다. `claude --plugin-dir .claude/plugin`
> 으로 바로 시작할 수 있습니다.

### 다른 런타임 (수동 HTTP/MCP)

Claude Code 이외의 런타임은 자동 어댑터가 없습니다.
[External Project Setup § 5](./external-setup.md#5-attach-other-runtimes-manual)
에서 HTTP API를 직접 호출하는 최소 구현 순서를 참고하세요.

## Reference

연동이 끝난 뒤 이벤트 표면과 런타임 모델을 더 깊이 살펴보려면
아래 문서를 참고하세요.

- [Runtime capabilities](./runtime-capabilities.md) — 런타임 어댑터별
  관찰 가능 범위와 세션 종료 정책
- [API integration map](./api-integration-map.md) — 모든 HTTP 엔드포인트와
  hook · 수동 런타임 매핑
- [Runtime API flow & preprocessing](./runtime-api-flow-and-preprocessing.md)
  — 각 엔드포인트 내부 전처리 규칙
- [Claude Code hook payload spec](./hook-payload-spec.md) — plugin이
  소비하는 hook payload의 정확한 JSON 구조
- [Task observability](./task-observability.md) — 대시보드가 사용하는
  `Flow` · `Health` read model
- [Web styling guide](./web-styling.md) — `@monitor/web`의
  CSS / Tailwind 컨벤션

## Related

- [Codebase wiki](/wiki/) — 아키텍처, 패키지, 유지보수 노트
- [Claude Code plugin adapter](/wiki/claude-code-plugin-adapter) —
  plugin 내부 구조
- [`setup:external` automation script](/wiki/setup-external-automation-script)
  — setup 스크립트가 실제로 하는 일
