# Analytics Tier

Agent Tracer의 analytics tier는 SQLite 운영 DB에서 DuckDB 분석 DB와
Evidence.dev BI 화면을 생성하는 로컬 분석 계층이다.

관련 스키마는 [DuckDB analytics schema](./duckdb-analytics-schema.md)를
참조한다.

## 구성

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| SQLite source | `.monitor/monitor.sqlite` | 운영 데이터 원본 |
| DuckDB analytics DB | `~/.agent-tracer/analytics.duckdb` | 분석용 bronze/silver/gold table |
| Portable Parquet bundle | `~/.agent-tracer/portable/analytics/` | BI와 외부 이관용 Parquet 파일 |
| Evidence BI app | `packages/analytics` | 로컬 BI 화면 |

## 데이터 흐름

```text
SQLite operational DB
  └─ DuckDB ETL
       ├─ analytics.duckdb
       └─ portable Parquet bundle
            └─ Evidence.dev BI
```

## 서버에서 DuckDB ETL 실행

서버가 SQLite port를 만들 때 DuckDB analytics service가 같이 시작된다.

```bash
npm run dev:server
```

전체 앱 실행 시에도 동일하게 동작한다.

```bash
npm run dev
```

ETL은 기본적으로 서버 시작 시 1회 실행되고 이후 1시간 간격으로 실행된다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `AGENT_TRACER_ANALYTICS_PATH` | `~/.agent-tracer/analytics.duckdb` | DuckDB DB 파일 |
| `AGENT_TRACER_ARCHIVE_DIR` | `~/.agent-tracer/archive/events` | event archive Parquet 위치 |
| `AGENT_TRACER_ANALYTICS_PORTABLE_DIR` | `~/.agent-tracer/portable/analytics` | BI용 portable Parquet 위치 |
| `AGENT_TRACER_ANALYTICS_ETL_INTERVAL_MS` | `3600000` | ETL 반복 주기 |
| `AGENT_TRACER_ANALYTICS_ARCHIVE_AFTER_DAYS` | `90` | event archive 기준 일수 |
| `AGENT_TRACER_ANALYTICS_DISABLED` | `false` | `true`면 자동 ETL 비활성화 |

## Evidence BI 실행

BI 화면은 Evidence.dev로 구성되어 있다.

```bash
npm run dev --workspace @monitor/analytics
```

접속 URL:

```text
http://127.0.0.1:5175/
```

`dev` 명령은 내부적으로 아래 작업을 먼저 실행한다.

1. Evidence plugin symlink 준비
2. portable Parquet bundle 동기화
3. Evidence source 생성
4. Evidence generated cache 삭제
5. Evidence dev server 시작

## Evidence source 생성

BI 데이터만 재생성하려면 아래 명령을 실행한다.

```bash
npm run sources --workspace @monitor/analytics
```

이 명령은 `~/.agent-tracer/portable/analytics`의 Parquet 파일을
`packages/analytics/sources/agent_tracer/data`로 동기화한 뒤 Evidence source를
생성한다.

## Evidence production build

```bash
npm run build --workspace @monitor/analytics
```

빌드 산출물은 `packages/analytics/build`에 생성된다. 이 디렉터리는 generated
artifact이므로 git에 포함하지 않는다.

## BI 페이지

현재 BI 앱은 task 중심 분석을 제공한다.

| URL | 목적 |
|---|---|
| `/` | Runtime Outcomes: 30d KPI, 주간 성공률 추세, runtime/task kind 분석 |
| `/tasks/` | Task Explorer: 전체 task master table, 필터, drill-in link |
| `/tasks/[task_id]/` | Task Anatomy: 단일 task의 KPI, 도구 카테고리 분포, session/tool sequence, context, evaluation, subagent |
| `/task-efficiency/` | tool 호출 강도, idle ratio, 효율성 hot list |
| `/task-retry/` | retry 비율, tool 실패 hot spot, worst offender task |
| `/task-subagent/` | subagent 위임 비율과 성능 |
| `/context-window/` | task별 context window 사용률, 주간 compact 추세, model별 pressure, at-risk hot list |

## Portable Parquet bundle

DuckDB ETL은 gold/dim table을 Parquet으로 내보낸다.

```text
~/.agent-tracer/portable/analytics/
  fact_task_summary.parquet
  fact_sessions.parquet
  fact_tool_calls.parquet
  fact_evaluations.parquet
  fact_task_context.parquet
  dim_task.parquet
  dim_tool.parquet
  dim_time.parquet
```

Evidence BI는 이 bundle을 읽는다.

## 직접 DuckDB 조회

DuckDB 파일을 직접 열어 분석할 수 있다.

```sql
select * from fact_sessions;
select * from fact_tool_calls order by invoked_at_ms desc limit 20;
select * from fact_task_summary order by completed_at_ms desc nulls last limit 20;
```

서버 코드에서는 analytics service helper로도 조회할 수 있다.

```ts
const rows = await analytics.queryRows("select * from fact_sessions limit 10");
```

## 검증 명령

```bash
npm run test --workspace @monitor/server -- duckdb.analytics.service.test.ts
npm run sources --workspace @monitor/analytics
npm run build --workspace @monitor/analytics
```

전체 검증:

```bash
npm run lint --workspace @monitor/server
npm run test --workspace @monitor/server
npm run build --workspace @monitor/server
npm run lint:deps
npm run docs:build
```

## 자주 보는 문제

### Evidence 화면에서 Parquet 파일 오류가 나는 경우

Evidence source cache나 0-row parquet 파일이 오래된 상태일 수 있다.

```bash
npm run sources --workspace @monitor/analytics
npm run dev --workspace @monitor/analytics
```

### Evidence 화면에 예전 쿼리가 남아 있는 경우

`dev` 명령은 cache를 자동으로 지운다. 수동으로 지우려면 아래 명령을 사용한다.

```bash
npm run clean:evidence --workspace @monitor/analytics
```

### portable Parquet 파일이 없는 경우

서버를 한 번 실행해서 DuckDB ETL이 portable bundle을 생성하게 한다.

```bash
npm run dev:server
```
