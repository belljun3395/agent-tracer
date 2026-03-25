# setup:external Automation Script

`npm run setup:external`은 외부 프로젝트에 필요한 설정 파일과 shim을 생성하는 자동화 스크립트다.

## 핵심 파일

- `scripts/setup-external.mjs`
- `docs/guide/external-setup.md`

## 하는 일

- Claude / OpenCode / Codex용 설정 파일 생성
- repo-local integration 진입점 구성

## 현재 주의점

- 일부 런타임은 remote `main` 기반, 일부는 local file 기반이라 버전 혼합 가능성이 있다
- 기본 동작을 현재 checkout 또는 현재 git SHA 기준으로 맞추는 편이 안전하다
