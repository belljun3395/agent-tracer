# Event Classification Engine

Agent Tracer가 많은 이벤트를 한 화면에서 읽기 쉽게 보여줄 수 있는 이유는
모든 기록을 저장 전에 분류해 두기 때문이다. 이 분류는 단순 색칠용이 아니라,
lane 배치, tag 필터, rule gap 보기, connector 해석의 기반이 된다.

## 핵심 파일

- `packages/core/src/classifier.ts`
- `packages/core/src/action-registry.ts`
- `packages/core/src/domain.ts`
- `packages/server/src/application/services/event-recorder.ts`
- `packages/server/src/application/services/trace-metadata-factory.ts`

## 분류 입력

`classifyEvent()`는 아래 정보를 입력으로 받는다.

- `kind`
- `title`, `body`
- `command`
- `toolName`
- `actionName`
- `filePaths`
- 명시적 `lane`

이 입력은 server의 `EventRecorder`가 event를 저장하기 직전에 조립한다.

## 분류 순서

1. event kind에서 canonical lane 후보를 구한다.
2. `action-registry`로 action name 기반 매치를 찾는다.
3. 호출자가 lane을 명시했다면 그것을 우선한다.
4. 그렇지 않으면 canonical lane, action match lane, default lane 순으로 결정한다.
5. 매치된 tag와 `TraceMetadataFactory`가 만든 contextual tag를 합친다.

즉, 최종 lane은 "kind 기본값"만으로 정해지지 않는다.
MCP 수동 호출처럼 명시적 lane이 있는 경우는 그 정보가 우선한다.

## action registry의 역할

`action-registry.ts`는 `inspect_current_state`, `design_solution` 같은
snake_case action 이름에서 의미를 추론하는 역할을 한다.

여기서 얻는 것:

- lane 힌트
- tag
- 매치 이유와 점수

이 구조 덕분에 `monitor_plan`, `monitor_action`, `monitor_verify`, `monitor_rule`처럼
generic endpoint도 어느 정도 의미를 잃지 않고 분류할 수 있다.

## EventRecorder와의 연결

실제 저장 경로는 아래처럼 읽으면 된다.

1. `MonitorService`가 입력을 정리한다.
2. `EventRecorder.record()`가 `classifyEvent()`를 호출한다.
3. `TraceMetadataFactory`가 relation, activity, verification 상태, compact signal 같은 metadata 기반 tag를 추가한다.
4. 완성된 classification과 metadata가 SQLite에 저장된다.

## 현재 구조의 좋은 점

- 단순하고 예측 가능하다.
- 명시적 lane override와 자동 분류를 함께 쓸 수 있다.
- 분류 이유와 tags를 함께 저장하므로 UI에서 필터링과 설명이 가능하다.

## 현재 주의점

### richer phase semantics를 전부 강제하지는 않는다

`question.logged`, `todo.logged`, `user.message`는 문서상 canonical contract가 있지만,
classifier 자체는 그 전체 의미를 enforcement하지 않는다.

### metadata 해석이 분산돼 있다

lane은 core가 정하지만, tag 일부는 `TraceMetadataFactory`, view-specific 해석은
웹의 `insights.ts`가 맡고 있어 의미 계층이 여러 곳에 나뉘어 있다.

### derived file event 노이즈 제어가 필요하다

`EventRecorder.recordWithDerivedFiles()`는 `file.changed` 파생 이벤트를 만들지만,
exploration/background 레인에서는 의도적으로 생성을 제한한다.
이 정책을 모르면 이벤트 수가 왜 예상보다 적거나 많은지 이해하기 어렵다.

## 분류 규칙을 바꿀 때 체크리스트

- lane 변경이 대시보드 색상, 필터, observability badge에 미치는 영향 확인
- action-registry tag가 workflow search나 insights에 유용한지 확인
- 명시적 lane을 쓰는 MCP 경로와 충돌하지 않는지 확인
- derived file event 정책을 깨지 않는지 확인

## 관련 문서

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Timeline Canvas](./timeline-canvas.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
