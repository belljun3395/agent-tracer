# Glossary

## Task

사용자 목표 단위의 상위 work item. 상태는 보통 `running`, `waiting`, `completed`, `errored` 중 하나다.

## Session

task 안에서의 개별 agent 실행 구간. 같은 task에 여러 session이 이어 붙을 수 있다.

## Timeline Event

tool use, user message, verification, thought, assistant response 같은 개별 기록 단위.

## Lane

event를 읽기 쉽게 나누는 수직 분류 축. core 기준 canonical lane은 8개다.

## Runtime Adapter

Claude plugin 처럼 이벤트를 수집해 Agent Tracer 서버에 보내는 런타임 통합 경로.

## Runtime Session Binding

외부 런타임의 stable session/thread ID를 monitor task/session에 연결하는 저장 레이어.

## Workflow Library

과거 작업을 평가(`good`/`skip`)하고, 나중에 다시 검색할 수 있게 만드는 기능 집합.

## Workflow Summary

workflow library 목록에 표시되는 축약 레코드. 평가 정보와 task 메타데이터가 함께 들어 있다.

## Workflow Context

유사 검색 결과에 포함되는 markdown 요약. 원래 요청, 주요 단계, 수정 파일, TODO, 검증 정보를 압축한다.

## Handoff

현재 task 상태를 다른 에이전트나 다음 세션으로 넘길 수 있도록 요약하는 표현. UI에서는 `TaskHandoffPanel`과 handoff markdown/XML 생성기로 나타난다.

## Compact Event

에이전트가 컨텍스트를 요약하거나 줄였다는 신호. planning/insight 문맥에서 시간 마커처럼 쓰인다.

## Gap Report

monitor server가 꺼져 있어도 작업은 계속하고, 남기지 못한 기록을 마지막에 요약하는 운영 정책.
