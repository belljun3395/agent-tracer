# DuckDB Analytics Schema

DuckDB analytics schema는 SQLite 운영 DB를 분석하기 위한 bronze/silver/gold
table로 구성되며, task-centric BI를 위해 `fact_task_summary`를 gold 테이블로 삼는다.

## Table Overview

| Layer | Table | Grain | 설명 |
|---|---|---|---|
| Bronze | `bronze_events` | event | SQLite source event를 event-shaped row로 복사 |
| Bronze | `bronze_events_with_archive` | event | hot bronze + archived Parquet union view |
| Silver | `silver_session_runs` | session | session duration/outcome/runtime 집계 |
| Silver | `silver_tool_calls` | tool invocation | tool invocation과 result pairing |
| Fact | `fact_sessions` | session | session fact (phase_guess 포함) |
| Fact | `fact_tool_calls` | tool invocation | tool usage/failure fact (tool_category, target, failure 포함) |
| Fact | `fact_evaluations` | evaluation | evaluation fact |
| Fact | `fact_task_context` | task | task별 context window, turn, compact, token 집계 |
| Fact | `fact_turn_tokens` | turn (API call) | 턴 단위 token/cost breakdown (context.snapshot, token.usage 기반) |
| Fact | `fact_task_summary` | task | task-level gold summary |
| Dimension | `dim_task` | task | task dimension |
| Dimension | `dim_tool` | tool | tool classification dimension |
| Dimension | `dim_time` | date | date dimension |

## `bronze_events`

| Column | Type | 설명 |
|---|---:|---|
| `event_id` | `varchar` | event id |
| `event_time_ms` | `bigint` | event 발생 시각, Unix ms |
| `event_at` | `timestamp` | event 발생 timestamp |
| `event_type` | `varchar` | event type |
| `schema_ver` | `integer` | event schema version |
| `task_id` | `varchar` | task id |
| `session_id` | `varchar` | session id |
| `actor` | `varchar` | event actor |
| `correlation_id` | `varchar` | correlation id |
| `causation_id` | `varchar` | causation id |
| `payload_json` | `varchar` | event payload JSON |
| `recorded_at_ms` | `bigint` | DB 기록 시각, Unix ms |
| `recorded_at` | `timestamp` | DB 기록 timestamp |
| `source_table` | `varchar` | SQLite source table 이름 |

## `silver_session_runs`

| Column | Type | 설명 |
|---|---:|---|
| `session_id` | `varchar` | session id |
| `task_id` | `varchar` | task id |
| `task_kind` | `varchar` | task kind |
| `runtime_source` | `varchar` | runtime source |
| `status` | `varchar` | session status |
| `outcome` | `varchar` | normalized outcome |
| `started_at_ms` | `bigint` | 시작 시각, Unix ms |
| `ended_at_ms` | `bigint` | 종료 시각, Unix ms |
| `duration_ms` | `bigint` | session duration |
| `event_count` | `bigint` | session event 수 |

## `silver_tool_calls`

| Column | Type | 설명 |
|---|---:|---|
| `call_id` | `varchar` | tool invocation event id |
| `result_event_id` | `varchar` | matching result event id |
| `task_id` | `varchar` | task id |
| `session_id` | `varchar` | session id |
| `invoked_at_ms` | `bigint` | 호출 시각, Unix ms |
| `invoked_at` | `timestamp` | 호출 timestamp |
| `tool_name` | `varchar` | tool name |
| `duration_ms` | `bigint` | duration |
| `outcome` | `varchar` | outcome |
| `has_result_event` | `boolean` | result event pairing 여부 |
| `payload_json` | `varchar` | invocation payload |

## `fact_sessions`

| Column | Type | 설명 |
|---|---:|---|
| `session_id` | `varchar` | session id |
| `task_id` | `varchar` | task id |
| `task_kind` | `varchar` | task kind |
| `runtime_source` | `varchar` | runtime source |
| `status` | `varchar` | session status |
| `outcome` | `varchar` | normalized outcome |
| `started_at_ms` | `bigint` | 시작 시각 |
| `ended_at_ms` | `bigint` | 종료 시각 |
| `duration_ms` | `bigint` | duration |
| `event_count` | `bigint` | event 수 |
| `phase_guess` | `varchar` | `exploration`, `implementation`, `verification`, `mixed`, `unknown` |

## `fact_tool_calls`

| Column | Type | 설명 |
|---|---:|---|
| `call_id` | `varchar` | tool invocation id |
| `result_event_id` | `varchar` | result event id |
| `task_id` | `varchar` | task id |
| `session_id` | `varchar` | session id |
| `invoked_at_ms` | `bigint` | 호출 시각 |
| `time_key` | `integer` | `YYYYMMDD` date key |
| `tool_name` | `varchar` | tool name |
| `tool_category` | `varchar` | `dim_tool`의 category (file_read, file_write, shell 등) |
| `duration_ms` | `bigint` | duration |
| `outcome` | `varchar` | outcome (`failed=true`는 'failure'로 승격됨) |
| `has_result_event` | `boolean` | result event pairing 여부 |
| `failed` | `boolean` | `PostToolUseFailure` hook이 보고한 실패 여부 |
| `error_message` | `varchar` | 실패 시 error 문구 |
| `is_interrupt` | `boolean` | 사용자 중단 여부 |
| `file_path` | `varchar` | 호출 대상 파일 절대경로 (File tool) |
| `rel_path` | `varchar` | 호출 대상 파일 상대경로 |
| `command_text` | `varchar` | Bash 호출 실제 명령어 |
| `command_description` | `varchar` | Bash 호출 설명 |
| `search_pattern` / `search_path` / `search_query` | `varchar` | Explore (Grep/Glob/WebSearch) 입력 |
| `web_url` | `varchar` | WebFetch / Explore url 대상 |
| `mcp_server` / `mcp_tool` | `varchar` | MCP 호출 서버/툴 |
| `call_target` | `varchar` | 위 컬럼 중 가장 의미있는 값 (BI 표시용) |

## `fact_evaluations`

| Column | Type | 설명 |
|---|---:|---|
| `task_id` | `varchar` | task id |
| `scope_key` | `varchar` | evaluation scope |
| `scope_kind` | `varchar` | `task` 또는 `turn` |
| `turn_index` | `integer` | turn index |
| `rating` | `varchar` | evaluation rating |
| `use_case` | `varchar` | use case |
| `workflow_tags` | `varchar` | tags JSON |
| `outcome_note` | `varchar` | outcome note |
| `evaluated_at_ms` | `bigint` | 평가 시각 |
| `reuse_count` | `bigint` | reuse count |
| `briefing_copy_count` | `bigint` | briefing copy count |

## `fact_task_context`

| Column | Type | 설명 |
|---|---:|---|
| `task_id` | `varchar` | task id |
| `title` | `varchar` | BI display title |
| `raw_title` | `varchar` | runtime/source title before BI cleanup |
| `display_title` | `varchar` | BI-friendly task title derived from prompt/parent context |
| `title_source` | `varchar` | `raw`, `first_user_prompt`, `parent_task`, or `runtime_fallback` |
| `title_quality` | `varchar` | `raw`, `derived`, or `generic` |
| `status` | `varchar` | task status |
| `task_kind` | `varchar` | task kind |
| `runtime_source` | `varchar` | runtime source |
| `context_event_count` | `bigint` | context/token 관련 event 수 |
| `user_turn_count` | `bigint` | user turn 수 |
| `assistant_turn_count` | `bigint` | assistant turn 수 |
| `compact_count` | `bigint` | compact 관련 event 수 |
| `latest_context_at_ms` | `bigint` | 마지막 context snapshot 시각 |
| `avg_context_used_pct` | `double` | 평균 context window 사용률 |
| `max_context_used_pct` | `double` | 최대 context window 사용률 |
| `min_context_remaining_pct` | `double` | 최소 context window 잔여율 |
| `max_context_total_tokens` | `bigint` | 최대 context total token 수 |
| `context_window_size` | `bigint` | context window size |
| `max_turn_input_tokens` | `bigint` | 단일 턴 최대 input 토큰 |
| `max_turn_output_tokens` | `bigint` | 단일 턴 최대 output 토큰 |
| `sum_turn_input_tokens` | `bigint` | 태스크 전체 input 토큰 합 |
| `sum_turn_output_tokens` | `bigint` | 태스크 전체 output 토큰 합 |
| `sum_cache_read_tokens` | `bigint` | 태스크 전체 prompt-cache 읽기 토큰 합 |
| `sum_cache_creation_tokens` | `bigint` | 태스크 전체 prompt-cache 생성 토큰 합 |
| `max_cost_total_usd` | `double` | 태스크 최종 누적 비용 (USD) |
| `model_id` | `varchar` | context snapshot이 보고한 model id |

## `fact_turn_tokens`

`context.snapshot` / `token.usage` event당 1행. Claude Code의 StatusLine은 매 API call 후 스냅샷을 emit하므로 **한 턴 = 한 API call** 단위 분석이 가능합니다. Codex의 `lastTurn*Tokens`도 동일 컬럼으로 매핑됩니다.

| Column | Type | 설명 |
|---|---:|---|
| `event_id` | `varchar` | snapshot event id |
| `task_id` | `varchar` | task id |
| `session_id` | `varchar` | session id |
| `event_time_ms` | `bigint` | snapshot 시각 |
| `time_key` | `integer` | `YYYYMMDD` date key |
| `event_type` | `varchar` | `context.snapshot` or `token.usage` |
| `input_tokens` | `bigint` | 이 턴의 input tokens |
| `output_tokens` | `bigint` | 이 턴의 output tokens |
| `cache_read_tokens` | `bigint` | 이 턴의 prompt cache read tokens |
| `cache_creation_tokens` | `bigint` | 이 턴의 prompt cache creation tokens |
| `context_window_total_tokens` | `bigint` | 누적 context window 사용 tokens |
| `context_used_pct` | `double` | context window 사용률 |
| `context_window_size` | `bigint` | context window 최대 size |
| `cost_total_usd` | `double` | 누적 비용 (USD) |
| `model_id` | `varchar` | snapshot을 emit한 모델 id |

## `fact_task_summary`

Task-centric BI 질의의 단일 진입점. `dim_task` + `fact_sessions` + `fact_tool_calls` + `fact_task_context` + `fact_evaluations`를 task 단위로 집계한다.

| Column | Type | 설명 |
|---|---:|---|
| `task_id` | `varchar` | task id |
| `parent_task_id` | `varchar` | parent task id |
| `display_title` | `varchar` | BI display title |
| `task_kind` | `varchar` | task kind |
| `runtime_source` | `varchar` | runtime source |
| `model_id` | `varchar` | last observed model id |
| `workspace_path` | `varchar` | workspace path |
| `started_at_ms` | `bigint` | task 시작 시각 |
| `completed_at_ms` | `bigint` | task 완료 시각 |
| `wall_clock_ms` | `bigint` | completed - started |
| `completed_time_key` | `integer` | `YYYYMMDD` key |
| `active_ms` | `bigint` | session duration 합 |
| `idle_ratio` | `double` | 1 - active_ms / wall_clock_ms |
| `status` | `varchar` | task status |
| `outcome` | `varchar` | normalized outcome |
| `has_subagent` | `boolean` | subagent 사용 여부 |
| `subagent_count` | `bigint` | subagent 수 |
| `session_count` | `bigint` | session 수 |
| `retry_count` | `bigint` | 실패한 session 재시도 수 |
| `event_count` | `bigint` | event 수 |
| `user_turn_count` | `bigint` | user turn 수 |
| `assistant_turn_count` | `bigint` | assistant turn 수 |
| `tool_call_count` | `bigint` | tool invocation 수 |
| `distinct_tool_count` | `bigint` | 고유 tool 수 |
| `tool_failure_count` | `bigint` | 실패한 tool 수 |
| `tool_failure_rate` | `double` | tool_failure / tool_call |
| `write_count` / `read_count` / `edit_count` / `search_count` / `shell_count` / `web_count` / `verify_count` | `bigint` | category별 tool 수 |
| `compact_count` | `bigint` | compact event 수 |
| `max_context_used_pct` / `avg_context_used_pct` / `min_context_remaining_pct` | `double` | context 사용률 |
| `max_context_total_tokens` / `context_window_size` | `bigint` | 토큰 관련 값 |
| `evaluation_rating` / `use_case` / `workflow_tags` | `varchar` | task scope evaluation 정보 |
| `reuse_count` / `briefing_copy_count` / `evaluation_count` | `bigint` | evaluation 활동 지표 |
| `difficulty_score` | `double` | `ln(1+tool)+1.5*ln(1+session)+2*compact+10*tool_failure_rate+3*retry` |

## Dimensions

### `dim_task`

| Column | 설명 |
|---|---|
| `task_id` | task id |
| `title` | BI display title |
| `raw_title` | runtime/source title before BI cleanup |
| `display_title` | BI-friendly task title derived from prompt/parent context |
| `title_source` | display title source |
| `title_quality` | display title quality |
| `slug` | task slug |
| `workspace_path` | workspace path |
| `task_kind` | task kind |
| `parent_task_id` | parent task id |
| `status` | current status |
| `runtime_source` | runtime source |
| `valid_from_ms` | valid-from timestamp ms |
| `valid_to_ms` | valid-to timestamp ms |
| `is_current` | current row 여부 |
| `updated_at_ms` | update timestamp ms |

### `dim_tool`

| Column | 설명 |
|---|---|
| `tool_name` | tool name (Read, Write, Bash ...) |
| `tool_category` | file_read/file_write/file_edit/search/shell/web_fetch/web_search/agent/todo/plan/test_run/build_run/rule_check/git/other |
| `is_mutation` | 파일/상태를 변경할 가능성이 있는 도구 여부 |
| `is_shell` | shell 계열인지 여부 |

### `dim_time`

| Column | 설명 |
|---|---|
| `time_key` | `YYYYMMDD` key |
| `date` | date |
| `year` | year |
| `month` | month |
| `day` | day |
| `day_of_week` | day of week |

## Derived Fields

원천(SQLite `tasks_current`, `sessions_current`, `events` 등) 위에서 ETL이
직접 계산해 새로 만든 필드들이다. 단순 rename/cast는 제외하고, 계산 로직이 있는
것만 모았다.

### `difficulty_score` (fact_task_summary)

태스크가 얼마나 "고된 작업"이었는지를 한 숫자로 나타낸 합성 점수. 시간 기반이
아니라 **행동 기반**이다.

```
difficulty_score =
    ln(1 + tool_call_count)
  + ln(1 + session_count) * 1.5
  + compact_count * 2
  + tool_failure_rate * 10
  + retry_count * 3
```

| Term | 의미 |
|---|---|
| `ln(1 + tool_call_count)` | 도구 호출 수. log 스케일로 완만하게 증가 |
| `ln(1 + session_count) * 1.5` | 여러 세션 = 중단/재개 많았다는 뜻 |
| `compact_count * 2` | compact는 선형 가중, 기억 손실 위험 반영 |
| `tool_failure_rate * 10` | 실패율 100% = +10 |
| `retry_count * 3` | 이전 실패 후 재시도 횟수 |

단위는 없음. 상대 비교용.

### `outcome` (fact_task_summary, fact_sessions)

`status` 값을 정규화:

```
outcome =
  case
    when status in ('completed', 'success')              then 'success'
    when status in ('errored', 'error', 'failed',
                    'failure')                           then 'failure'
    else status
  end
```

### `retry_count` (fact_task_summary)

같은 task에서 "가장 최근 session이 아닌" 실패 session 수.

```sql
select count(*)
from (
  select outcome,
         row_number() over (partition by task_id
                            order by started_at_ms desc) as rn
  from fact_sessions
) ranked
where outcome = 'failure' and rn > 1
```

마지막 session이 성공이면 `retry_count = 모든 실패 수`, 마지막도 실패면
`retry_count = 실패 수 - 1`이다.

### `tool_failure_rate` (fact_task_summary)

```
tool_failure_rate = tool_failure_count / tool_call_count
(tool_call_count = 0 → 0)
```

`tool_failure_count`는 `fact_tool_calls.outcome ∈ {failure, failed, error, errored}`
인 호출 수.

### `wall_clock_ms`, `active_ms`, `idle_ratio` (fact_task_summary)

```
wall_clock_ms = completed_at_ms - started_at_ms
active_ms     = sum(fact_sessions.duration_ms)
idle_ratio    = 1 - active_ms / wall_clock_ms
```

`idle_ratio`는 태스크가 시작된 이후 **session이 돌지 않고 있던 시간 비율**.
사용자가 자리를 비웠을 때 올라간다.

### `phase_guess` (fact_sessions)

Session 안에서 어떤 카테고리 도구가 우세했는지 heuristic.

```
V = verify_count  (test_run | build_run | rule_check)
E = explore_count (file_read | search)
I = impl_count    (file_write | file_edit)
N = V + E + I

phase_guess =
  case
    when N = 0             then 'unknown'
    when V >= N * 0.3      then 'verification'
    when E > I * 2         then 'exploration'
    when I > E             then 'implementation'
    else                        'mixed'
  end
```

순서가 중요: verification이 30% 이상이면 다른 조건을 보지 않고 `verification`.

### `tool_category` / `is_mutation` / `is_shell` (dim_tool)

Tool name → category 매핑:

| Category | 매치 예시 |
|---|---|
| `file_read` | `Read`, `cat`, `head`, `tail`, `less`, `sed`, `awk` |
| `file_write` | `Write` |
| `file_edit` | `Edit`, `NotebookEdit` |
| `search` | `Grep`, `Glob`, `rg`, `grep`, `find`, `fd`, `ls` |
| `shell` | `Bash` 및 위에서 매칭 안 된 shell 명령 |
| `web_fetch` | `WebFetch`, `curl`, `wget` |
| `web_search` | `WebSearch` |
| `agent` | `Task`, `Agent` |
| `todo` | `TodoWrite` |
| `plan` | `ExitPlanMode`, `EnterPlanMode` |
| `test_run` | `npm test`, `pytest`, `jest`, `vitest`, `cargo test`, `go test` |
| `build_run` | `npm build`, `tsc`, `vite build`, `cargo build`, `go build`, `make`, `gradle`, `mvn` |
| `rule_check` | `eslint`, `prettier`, `stylelint`, `ruff`, `black`, `golangci-lint`, `lint`, `typecheck` |
| `git` | `git *` |
| `other` | 그 외 전부 |

`is_mutation`: `Write`, `Edit`, `NotebookEdit`, `TodoWrite`, `touch`, `mv`, `rm`,
`cp`, `mkdir` 계열에서 true.

`is_shell`: 알려진 non-shell tool(Read/Write/Edit/Grep/Glob/WebFetch/WebSearch/
Task/TodoWrite/NotebookEdit/ExitPlanMode/EnterPlanMode/Agent)이 아니면 true.

### `display_title`, `title_source`, `title_quality` (dim_task, fact_task_context, fact_task_summary)

Runtime이 만들어둔 `title`이 `Claude Code — ...`, `Codex CLI — ...`, `Error: ...`,
`Subagent:...`처럼 의미 없는 경우 첫 user prompt 또는 부모 task title로 대체.

우선순위:

1. `Subagent:` prefix → parent task의 display_title 앞에 subagent 이름 결합
   (`title_source = parent_task`, `title_quality = derived`)
2. runtime-generated + 첫 user prompt 있음
   → `Codex session: <prompt>` (codex-cli) / `<prompt>`
   (`title_source = first_user_prompt`, `title_quality = derived`)
3. runtime-generated + 프롬프트 없음 → runtime별 고정 문구
   (`title_source = runtime_fallback`, `title_quality = generic`)
4. 그 외 → raw title 그대로 (`title_source = raw`, `title_quality = raw`)

첫 prompt 선택에도 휴리스틱 있음: `Error:`, `Data table`, `select/with` (SQL
echo), `http://localhost:*` 등은 낮은 우선순위로 밀려서 사람이 실제로 타이핑한
프롬프트가 뽑힌다.

### `compact_count` (fact_task_context, fact_task_summary)

다음 중 하나라도 해당하면 compact event로 카운트:

```
event_type = 'context.saved'
  OR lower(event_type) LIKE '%compact%'
  OR payload.compactEvent = 'true'
  OR payload.compactPhase IS NOT NULL
```

### `max_context_used_pct`, `min_context_remaining_pct` (fact_task_context)

Context snapshot event payload의 `contextWindowUsedPct` /
`contextWindowRemainingPct`를 task 단위로 max/min. 런타임이 auto-compact 직전
값을 `>100`으로 emit하는 경우가 있어서 BI 표시 레이어에서는
`least(100, greatest(0, ...))`으로 clamp하지만, ETL은 raw 값을 그대로 저장한다
(이상 탐지용).

### `user_turn_count`, `assistant_turn_count` (fact_task_context)

```
user_turn_count      = event_type ∈ {'prompt.submitted', 'user.message'}
assistant_turn_count = event_type ∈ {'completion.received', 'assistant.response'}
```

### `tool_call pairing` (silver_tool_calls)

`silver_tool_calls`는 `tool.invoked` / `tool.used` / `terminal.command` 이벤트
(invocation)와 `tool.result` 이벤트(result)를 session_id + tool_name 기준으로
pair한다. 같은 invocation에 다수 result가 붙을 수 있으므로 가장 빠른 result만
고른다(`result_rank = 1`).

`duration_ms`는 다음 우선순위로 결정:
1. result payload `duration_ms` / `durationMs`
2. invocation payload `duration_ms` / `durationMs`
3. result_time - invoked_time
