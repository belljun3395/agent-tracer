export type AnalyticsSourceTable = "events" | "timeline_events_view";

export function quoteDuckDbString(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
}

function sqliteScan(sqlitePath: string, tableName: string): string {
    return `sqlite_scan(${quoteDuckDbString(sqlitePath)}, ${quoteDuckDbString(tableName)})`;
}

function dateMsExpression(columnName: string): string {
    return `epoch_ms(coalesce(
        try_cast(${columnName} as timestamp),
        try_strptime(${columnName}, '%Y-%m-%dT%H:%M:%S.%fZ'),
        try_strptime(${columnName}, '%Y-%m-%dT%H:%M:%SZ')
    ))`;
}

export function buildDuckDbAnalyticsSql(options: {
    readonly sqlitePath: string;
    readonly sourceTable: AnalyticsSourceTable;
    readonly archiveFiles?: readonly string[];
}): readonly string[] {
    const { sqlitePath, sourceTable, archiveFiles = [] } = options;
    const sourceSql = sourceTable === "events"
        ? buildDomainEventBronzeSql(sqlitePath)
        : buildTimelineEventBronzeSql(sqlitePath);

    return [
        sourceSql,
        buildBronzeArchiveViewSql(archiveFiles),
        buildSilverSessionRunsSql(sqlitePath),
        buildSilverToolCallsSql(),
        buildDimToolSql(),
        buildFactToolCallsSql(),
        buildFactSessionsSql(),
        buildFactEvaluationsSql(sqlitePath),
        buildFactTaskContextSql(sqlitePath),
        buildFactTurnTokensSql(),
        buildDimTaskSql(sqlitePath),
        buildDimTimeSql(),
        buildFactTaskSummarySql(),
        buildEtlMetadataSql(sourceTable),
    ];
}

function buildDomainEventBronzeSql(sqlitePath: string): string {
    return `
create or replace table bronze_events as
select
  event_id,
  cast(event_time as bigint) as event_time_ms,
  to_timestamp(cast(event_time as double) / 1000.0) as event_at,
  event_type,
  cast(schema_ver as integer) as schema_ver,
  coalesce(aggregate_id, json_extract_string(payload_json, '$.task_id')) as task_id,
  session_id,
  actor,
  correlation_id,
  causation_id,
  payload_json,
  cast(recorded_at as bigint) as recorded_at_ms,
  to_timestamp(cast(recorded_at as double) / 1000.0) as recorded_at,
  'events' as source_table
from ${sqliteScan(sqlitePath, "events")};
`.trim();
}

function buildTimelineEventBronzeSql(sqlitePath: string): string {
    const eventTimeMs = dateMsExpression("created_at");
    return `
create or replace table bronze_events as
select
  id as event_id,
  ${eventTimeMs} as event_time_ms,
  to_timestamp(${eventTimeMs} / 1000.0) as event_at,
  kind as event_type,
  1 as schema_ver,
  task_id,
  session_id,
  coalesce(json_extract_string(metadata_json, '$.actor'), lane, 'system') as actor,
  json_extract_string(metadata_json, '$.correlation_id') as correlation_id,
  json_extract_string(metadata_json, '$.causation_id') as causation_id,
  json_object(
    'legacy_event_id', id,
    'kind', kind,
    'lane', lane,
    'title', title,
    'body', body,
    'metadata', json(metadata_json),
    'classification', json(classification_json)
  )::varchar as payload_json,
  ${eventTimeMs} as recorded_at_ms,
  to_timestamp(${eventTimeMs} / 1000.0) as recorded_at,
  'timeline_events_view' as source_table
from ${sqliteScan(sqlitePath, "timeline_events_view")};
`.trim();
}

function buildBronzeArchiveViewSql(archiveFiles: readonly string[]): string {
    if (archiveFiles.length === 0) {
        return `
create or replace view bronze_events_with_archive as
select * from bronze_events;
`.trim();
    }

    const fileList = archiveFiles.map(quoteDuckDbString).join(", ");
    return `
create or replace view bronze_events_with_archive as
select * from bronze_events
union all
select * from read_parquet([${fileList}], union_by_name = true);
`.trim();
}

function buildSilverSessionRunsSql(sqlitePath: string): string {
    const startedMs = dateMsExpression("s.started_at");
    const endedMs = dateMsExpression("s.ended_at");
    return `
create or replace table silver_session_runs as
select
  s.id as session_id,
  s.task_id,
  t.task_kind,
  coalesce(t.cli_source, rb.runtime_source, 'unknown') as runtime_source,
  s.status,
  case
    when s.status in ('completed', 'success') then 'success'
    when s.status in ('errored', 'error', 'failed', 'failure') then 'failure'
    else s.status
  end as outcome,
  ${startedMs} as started_at_ms,
  case when s.ended_at is null then null else ${endedMs} end as ended_at_ms,
  case when s.ended_at is null then null else ${endedMs} - ${startedMs} end as duration_ms,
  count(e.event_id) as event_count
from ${sqliteScan(sqlitePath, "sessions_current")} s
left join ${sqliteScan(sqlitePath, "tasks_current")} t on t.id = s.task_id
left join ${sqliteScan(sqlitePath, "runtime_bindings_current")} rb on rb.monitor_session_id = s.id
left join bronze_events e on e.session_id = s.id
group by
  s.id,
  s.task_id,
  t.task_kind,
  coalesce(t.cli_source, rb.runtime_source, 'unknown'),
  s.status,
  s.started_at,
  s.ended_at;
`.trim();
}

function buildSilverToolCallsSql(): string {
    // silver_tool_calls enriches raw tool events with target details and
    // failure signals extracted from payload metadata:
    //   file_path / rel_path  - File tool (Read/Write/Edit/NotebookEdit)
    //   command / description - Bash (terminal.command) hook
    //   pattern / search_path / search_query / web_url - Explore tool metadata
    //   mcp_server / mcp_tool - MCP tool calls
    //   failed / error_message / is_interrupt - PostToolUseFailure hook
    // metadata.failed=true is promoted to outcome='failure' so downstream
    // counts (fact_task_summary.tool_failure_count) pick up every failure
    // regardless of whether a tool.result event was emitted.
    return `
create or replace table silver_tool_calls as
with invocations as (
  select
    event_id,
    task_id,
    session_id,
    event_time_ms,
    event_at,
	    event_type,
	    coalesce(
	      json_extract_string(payload_json, '$.tool_name'),
	      json_extract_string(payload_json, '$.toolName'),
	      json_extract_string(payload_json, '$.metadata.tool_name'),
	      json_extract_string(payload_json, '$.metadata.toolName'),
	      json_extract_string(payload_json, '$.title'),
	      event_type
	    ) as tool_name,
	    coalesce(
	      json_extract_string(payload_json, '$.metadata.subtypeKey'),
	      json_extract_string(payload_json, '$.metadata.subtype_key')
	    ) as subtype_key,
	    coalesce(
	      try_cast(json_extract_string(payload_json, '$.duration_ms') as bigint),
      try_cast(json_extract_string(payload_json, '$.durationMs') as bigint),
      try_cast(json_extract_string(payload_json, '$.metadata.duration_ms') as bigint),
      try_cast(json_extract_string(payload_json, '$.metadata.durationMs') as bigint)
    ) as invocation_duration_ms,
    coalesce(json_extract_string(payload_json, '$.metadata.failed'), 'false') = 'true' as failed,
    coalesce(
      json_extract_string(payload_json, '$.metadata.error'),
      json_extract_string(payload_json, '$.error')
    ) as error_message,
    coalesce(json_extract_string(payload_json, '$.metadata.isInterrupt'), 'false') = 'true' as is_interrupt,
    case
      when coalesce(json_extract_string(payload_json, '$.metadata.failed'), 'false') = 'true' then 'failure'
      else coalesce(
        json_extract_string(payload_json, '$.outcome'),
        json_extract_string(payload_json, '$.metadata.outcome'),
        json_extract_string(payload_json, '$.metadata.status'),
        'unknown'
      )
    end as invocation_outcome,
    coalesce(
      json_extract_string(payload_json, '$.metadata.filePath'),
      json_extract_string(payload_json, '$.metadata.file_path')
    ) as file_path,
    coalesce(
      json_extract_string(payload_json, '$.metadata.relPath'),
      json_extract_string(payload_json, '$.metadata.rel_path')
    ) as rel_path,
    coalesce(
      json_extract_string(payload_json, '$.metadata.command'),
      json_extract_string(payload_json, '$.command'),
      json_extract_string(payload_json, '$.body')
    ) as command_text,
    coalesce(
      json_extract_string(payload_json, '$.metadata.description'),
      json_extract_string(payload_json, '$.description')
    ) as command_description,
    coalesce(
      json_extract_string(payload_json, '$.metadata.toolInput.pattern'),
      json_extract_string(payload_json, '$.metadata.pattern')
    ) as search_pattern,
    coalesce(
      json_extract_string(payload_json, '$.metadata.toolInput.path'),
      json_extract_string(payload_json, '$.metadata.path')
    ) as search_path,
    coalesce(
      json_extract_string(payload_json, '$.metadata.toolInput.query'),
      json_extract_string(payload_json, '$.metadata.query')
    ) as search_query,
    coalesce(
      json_extract_string(payload_json, '$.metadata.toolInput.url'),
      json_extract_string(payload_json, '$.metadata.webUrls[0]'),
      json_extract_string(payload_json, '$.metadata.url')
    ) as web_url,
    coalesce(
      json_extract_string(payload_json, '$.metadata.mcpServer'),
      json_extract_string(payload_json, '$.metadata.mcp_server')
    ) as mcp_server,
    coalesce(
      json_extract_string(payload_json, '$.metadata.mcpTool'),
      json_extract_string(payload_json, '$.metadata.mcp_tool')
    ) as mcp_tool,
    payload_json
  from bronze_events
  where event_type in ('tool.invoked', 'tool.used', 'terminal.command')
),
results as (
  select
    event_id,
    session_id,
    event_time_ms,
    coalesce(
      json_extract_string(payload_json, '$.tool_name'),
      json_extract_string(payload_json, '$.toolName'),
      json_extract_string(payload_json, '$.metadata.tool_name'),
      json_extract_string(payload_json, '$.metadata.toolName')
    ) as tool_name,
    coalesce(
      try_cast(json_extract_string(payload_json, '$.duration_ms') as bigint),
      try_cast(json_extract_string(payload_json, '$.durationMs') as bigint),
      try_cast(json_extract_string(payload_json, '$.metadata.duration_ms') as bigint),
      try_cast(json_extract_string(payload_json, '$.metadata.durationMs') as bigint)
    ) as result_duration_ms,
    coalesce(
      json_extract_string(payload_json, '$.outcome'),
      json_extract_string(payload_json, '$.metadata.outcome'),
      json_extract_string(payload_json, '$.metadata.status'),
      'unknown'
    ) as result_outcome
  from bronze_events
  where event_type = 'tool.result'
),
paired as (
  select
    i.*,
    r.event_id as result_event_id,
    r.event_time_ms as result_time_ms,
    r.result_duration_ms,
    r.result_outcome,
    row_number() over (
      partition by i.event_id
      order by r.event_time_ms asc nulls last
    ) as result_rank
  from invocations i
  left join results r on r.session_id = i.session_id
    and r.event_time_ms >= i.event_time_ms
    and (r.tool_name is null or i.tool_name = r.tool_name)
)
select
  event_id as call_id,
  result_event_id,
  task_id,
  session_id,
	  event_time_ms as invoked_at_ms,
	  event_at as invoked_at,
	  tool_name,
	  subtype_key,
	  coalesce(result_duration_ms, invocation_duration_ms, result_time_ms - event_time_ms) as duration_ms,
  case
    when failed then 'failure'
    else coalesce(nullif(result_outcome, 'unknown'), invocation_outcome, 'unknown')
  end as outcome,
  result_event_id is not null as has_result_event,
  failed,
  error_message,
  is_interrupt,
  file_path,
  rel_path,
  command_text,
  command_description,
  search_pattern,
  search_path,
  search_query,
  web_url,
  mcp_server,
  mcp_tool,
  payload_json
from paired
where result_rank = 1;
`.trim();
}

function buildDimToolSql(): string {
    // dim_tool classifies each observed tool_name into a category used
    // downstream by fact_tool_calls, fact_sessions.phase_guess, and
    // fact_task_summary.{write,read,edit,search,shell,web,verify}_count.
    // Full category list is documented in the BI glossary (/glossary).
    return `
create or replace table dim_tool as
with tool_names as (
	  select distinct
	    tool_name,
	    subtype_key
	  from silver_tool_calls
	  where tool_name is not null
	),
	classified as (
	  select
	    tool_name,
	    subtype_key,
	    case
	      when subtype_key = 'read_file' then 'file_read'
	      when subtype_key = 'create_file' then 'file_write'
	      when subtype_key in ('modify_file', 'delete_file', 'rename_file', 'apply_patch') then 'file_edit'
	      when subtype_key in ('grep_code', 'glob_files', 'list_files') then 'search'
	      when subtype_key = 'web_fetch' then 'web_fetch'
	      when subtype_key = 'web_search' then 'web_search'
	      when subtype_key = 'mcp_call' then 'mcp'
	      when tool_name = 'Read' then 'file_read'
	      when tool_name = 'Write' then 'file_write'
      when tool_name in ('Edit', 'NotebookEdit') then 'file_edit'
      when tool_name in ('Grep', 'Glob') then 'search'
      when tool_name = 'Bash' then 'shell'
      when tool_name = 'WebFetch' then 'web_fetch'
      when tool_name = 'WebSearch' then 'web_search'
      when tool_name in ('Task', 'Agent') then 'agent'
      when tool_name = 'TodoWrite' then 'todo'
      when tool_name in ('ExitPlanMode', 'EnterPlanMode') then 'plan'
      when regexp_matches(lower(tool_name), '^(npm|yarn|pnpm)( run)? test') then 'test_run'
      when regexp_matches(lower(tool_name), '^(pytest|jest|vitest|mocha)') then 'test_run'
      when regexp_matches(lower(tool_name), '^(cargo|go) test') then 'test_run'
      when regexp_matches(lower(tool_name), '^(npm|yarn|pnpm)( run)? build') then 'build_run'
      when regexp_matches(lower(tool_name), '^(tsc|rollup|webpack)') then 'build_run'
      when regexp_matches(lower(tool_name), '^(vite|esbuild) build') then 'build_run'
      when regexp_matches(lower(tool_name), '^(cargo|go) build') then 'build_run'
      when regexp_matches(lower(tool_name), '^(make|gradle|mvn)') then 'build_run'
      when regexp_matches(lower(tool_name), '^(eslint|prettier|stylelint|ruff|black|golangci-lint)') then 'rule_check'
      when regexp_matches(lower(tool_name), '^(npm|yarn|pnpm)( run)? lint') then 'rule_check'
      when regexp_matches(lower(tool_name), '^(npm|yarn|pnpm)( run)? typecheck') then 'rule_check'
      when regexp_matches(lower(tool_name), '^(rg |grep |find |fd )') then 'search'
	      when regexp_matches(lower(tool_name), '^ls($|[ /])') then 'search'
	      when regexp_matches(lower(tool_name), '^(cat |head |tail |less |more |sed |awk )') then 'file_read'
	      when regexp_matches(lower(tool_name), '^(curl |wget )') then 'web_fetch'
	      when lower(tool_name) = 'web_search_call' then 'web_search'
	      when lower(tool_name) = 'apply_patch' then 'file_edit'
	      when regexp_matches(lower(tool_name), '^mcp__') then 'mcp'
	      when regexp_matches(lower(tool_name), '^git ') then 'git'
	      else 'other'
	    end as tool_category,
	    case
	      when subtype_key in ('create_file', 'modify_file', 'delete_file', 'rename_file', 'apply_patch') then true
	      when tool_name in ('Write', 'Edit', 'NotebookEdit', 'TodoWrite') then true
	      when regexp_matches(lower(tool_name), '^(touch |mv |rm |cp |mkdir )') then true
	      else false
	    end as is_mutation,
	    case
	      when subtype_key is not null then false
	      when tool_name in ('Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite', 'NotebookEdit', 'ExitPlanMode', 'EnterPlanMode', 'Agent') then false
	      else true
	    end as is_shell
  from tool_names
)
select * from classified;
`.trim();
}

function buildFactToolCallsSql(): string {
    // fact_tool_calls carries the enriched target and failure details from
    // silver_tool_calls so BI pages can group by what tools actually did
    // (which files, which commands, which URLs) and surface failures.
    return `
create or replace table fact_tool_calls as
select
  s.call_id,
  s.result_event_id,
  s.task_id,
  s.session_id,
	  s.invoked_at_ms,
	  cast(strftime(s.invoked_at, '%Y%m%d') as integer) as time_key,
	  s.tool_name,
	  coalesce(d.tool_category, 'other') as tool_category,
  s.duration_ms,
  s.outcome,
  s.has_result_event,
  s.failed,
  s.error_message,
  s.is_interrupt,
  s.file_path,
  s.rel_path,
  s.command_text,
  s.command_description,
  s.search_pattern,
  s.search_path,
  s.search_query,
  s.web_url,
  s.mcp_server,
  s.mcp_tool,
  coalesce(
    s.file_path,
    s.rel_path,
    s.command_text,
    s.web_url,
    case when s.mcp_server is not null and s.mcp_tool is not null then concat(s.mcp_server, '::', s.mcp_tool) end,
    s.search_pattern,
    s.search_query,
    s.search_path
  ) as call_target
	from silver_tool_calls s
	left join dim_tool d
	  on d.tool_name = s.tool_name
	  and coalesce(d.subtype_key, '') = coalesce(s.subtype_key, '');
	`.trim();
	}

function buildFactSessionsSql(): string {
    // phase_guess: heuristic label from tool-category mix inside a session.
    // Rules applied in order — first match wins:
    //   verify ≥ 30% of categorized calls  -> 'verification'
    //   explore > impl * 2                 -> 'exploration'
    //   impl > explore                     -> 'implementation'
    //   otherwise                          -> 'mixed'
    //   no categorized calls               -> 'unknown'
    // See docs/guide/duckdb-analytics-schema.md § Derived Fields for rationale.
    return `
create or replace table fact_sessions as
with session_tool_categories as (
  select
    session_id,
    sum(case when tool_category in ('file_read', 'search') then 1 else 0 end) as explore_count,
    sum(case when tool_category in ('file_write', 'file_edit') then 1 else 0 end) as impl_count,
    sum(case when tool_category in ('test_run', 'build_run', 'rule_check') then 1 else 0 end) as verify_count,
    count(*) as categorized_count
  from fact_tool_calls
  where session_id is not null
  group by session_id
)
select
  s.session_id,
  s.task_id,
  s.task_kind,
  s.runtime_source,
  s.status,
  s.outcome,
  s.started_at_ms,
  s.ended_at_ms,
  s.duration_ms,
  s.event_count,
  case
    when c.categorized_count is null or c.categorized_count = 0 then 'unknown'
    when c.verify_count >= c.categorized_count * 0.3 then 'verification'
    when c.explore_count > c.impl_count * 2 then 'exploration'
    when c.impl_count > c.explore_count then 'implementation'
    else 'mixed'
  end as phase_guess
from silver_session_runs s
left join session_tool_categories c on c.session_id = s.session_id;
`.trim();
}

function buildFactEvaluationsSql(sqlitePath: string): string {
    const evaluatedMs = dateMsExpression("evaluated_at");
    return `
create or replace table fact_evaluations as
select
  task_id,
  scope_key,
  scope_kind,
  turn_index,
  rating,
  use_case,
  workflow_tags,
  outcome_note,
  ${evaluatedMs} as evaluated_at_ms,
  reuse_count,
  briefing_copy_count
from ${sqliteScan(sqlitePath, "evaluations_current")};
`.trim();
}

function buildFactTaskContextSql(sqlitePath: string): string {
    return `
create or replace table fact_task_context as
with ${buildTaskTitleCtes(sqlitePath)},
event_metrics as (
  select
    task_id,
    count(*) filter (where event_type in ('prompt.submitted', 'user.message')) as user_turn_count,
    count(*) filter (where event_type in ('completion.received', 'assistant.response')) as assistant_turn_count,
    count(*) filter (
      where event_type = 'context.saved'
         or lower(event_type) like '%compact%'
         or coalesce(
              json_extract_string(payload_json, '$.compactEvent'),
              json_extract_string(payload_json, '$.metadata.compactEvent')
            ) = 'true'
         or coalesce(
              json_extract_string(payload_json, '$.compactPhase'),
              json_extract_string(payload_json, '$.metadata.compactPhase')
            ) is not null
    ) as compact_count,
    count(*) filter (
      where event_type in ('context.snapshot', 'token.usage')
         or lower(event_type) like '%context%'
         or lower(event_type) like '%token%'
    ) as context_event_count,
    max(event_time_ms) filter (
      where event_type in ('context.snapshot', 'token.usage')
         or lower(event_type) like '%context%'
         or lower(event_type) like '%token%'
    ) as latest_context_at_ms,
    avg(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowUsedPct'),
      json_extract_string(payload_json, '$.metadata.contextWindowUsedPct')
    ) as double)) as avg_context_used_pct,
    max(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowUsedPct'),
      json_extract_string(payload_json, '$.metadata.contextWindowUsedPct')
    ) as double)) as max_context_used_pct,
    min(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowRemainingPct'),
      json_extract_string(payload_json, '$.metadata.contextWindowRemainingPct')
    ) as double)) as min_context_remaining_pct,
    max(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowTotalTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowTotalTokens')
    ) as bigint)) as max_context_total_tokens,
    max(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowSize'),
      json_extract_string(payload_json, '$.metadata.contextWindowSize')
    ) as bigint)) as context_window_size,
    max(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowInputTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowInputTokens'),
      json_extract_string(payload_json, '$.lastTurnInputTokens'),
      json_extract_string(payload_json, '$.metadata.lastTurnInputTokens')
    ) as bigint)) as max_turn_input_tokens,
    max(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowOutputTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowOutputTokens'),
      json_extract_string(payload_json, '$.lastTurnOutputTokens'),
      json_extract_string(payload_json, '$.metadata.lastTurnOutputTokens')
    ) as bigint)) as max_turn_output_tokens,
    sum(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowInputTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowInputTokens'),
      json_extract_string(payload_json, '$.lastTurnInputTokens'),
      json_extract_string(payload_json, '$.metadata.lastTurnInputTokens')
    ) as bigint)) as sum_turn_input_tokens,
    sum(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowOutputTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowOutputTokens'),
      json_extract_string(payload_json, '$.lastTurnOutputTokens'),
      json_extract_string(payload_json, '$.metadata.lastTurnOutputTokens')
    ) as bigint)) as sum_turn_output_tokens,
    sum(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowCacheReadTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowCacheReadTokens'),
      json_extract_string(payload_json, '$.lastTurnCacheReadTokens'),
      json_extract_string(payload_json, '$.metadata.lastTurnCacheReadTokens')
    ) as bigint)) as sum_cache_read_tokens,
    sum(try_cast(coalesce(
      json_extract_string(payload_json, '$.contextWindowCacheCreationTokens'),
      json_extract_string(payload_json, '$.metadata.contextWindowCacheCreationTokens'),
      json_extract_string(payload_json, '$.lastTurnCacheCreationTokens'),
      json_extract_string(payload_json, '$.metadata.lastTurnCacheCreationTokens')
    ) as bigint)) as sum_cache_creation_tokens,
    max(try_cast(coalesce(
      json_extract_string(payload_json, '$.costTotalUsd'),
      json_extract_string(payload_json, '$.metadata.costTotalUsd')
    ) as double)) as max_cost_total_usd,
    max(coalesce(
      json_extract_string(payload_json, '$.modelId'),
      json_extract_string(payload_json, '$.metadata.modelId')
    )) as model_id
  from bronze_events_with_archive
  group by task_id
)
select
  t.id as task_id,
  coalesce(tt.display_title, t.title) as title,
  t.title as raw_title,
  coalesce(tt.display_title, t.title) as display_title,
  coalesce(tt.title_source, 'raw') as title_source,
  coalesce(tt.title_quality, 'raw') as title_quality,
  t.status,
  t.task_kind,
  coalesce(t.cli_source, 'unknown') as runtime_source,
  coalesce(m.context_event_count, 0) as context_event_count,
  coalesce(m.user_turn_count, 0) as user_turn_count,
  coalesce(m.assistant_turn_count, 0) as assistant_turn_count,
  coalesce(m.compact_count, 0) as compact_count,
  m.latest_context_at_ms,
  round(coalesce(m.avg_context_used_pct, 0), 2) as avg_context_used_pct,
  round(coalesce(m.max_context_used_pct, 0), 2) as max_context_used_pct,
  round(coalesce(m.min_context_remaining_pct, 0), 2) as min_context_remaining_pct,
  coalesce(m.max_context_total_tokens, 0) as max_context_total_tokens,
  coalesce(m.context_window_size, 0) as context_window_size,
  coalesce(m.max_turn_input_tokens, 0) as max_turn_input_tokens,
  coalesce(m.max_turn_output_tokens, 0) as max_turn_output_tokens,
  coalesce(m.sum_turn_input_tokens, 0) as sum_turn_input_tokens,
  coalesce(m.sum_turn_output_tokens, 0) as sum_turn_output_tokens,
  coalesce(m.sum_cache_read_tokens, 0) as sum_cache_read_tokens,
  coalesce(m.sum_cache_creation_tokens, 0) as sum_cache_creation_tokens,
  round(coalesce(m.max_cost_total_usd, 0), 6) as max_cost_total_usd,
  m.model_id
from ${sqliteScan(sqlitePath, "tasks_current")} t
left join task_titles tt on tt.task_id = t.id
left join event_metrics m on m.task_id = t.id;
`.trim();
}

function buildDimTaskSql(sqlitePath: string): string {
    const createdMs = dateMsExpression("created_at");
    const updatedMs = dateMsExpression("updated_at");
    return `
create or replace table dim_task as
with ${buildTaskTitleCtes(sqlitePath)}
select
  t.id as task_id,
  coalesce(tt.display_title, t.title) as title,
  t.title as raw_title,
  coalesce(tt.display_title, t.title) as display_title,
  coalesce(tt.title_source, 'raw') as title_source,
  coalesce(tt.title_quality, 'raw') as title_quality,
  t.slug,
  t.workspace_path,
  t.task_kind,
  t.parent_task_id,
  t.status,
  t.cli_source as runtime_source,
  ${createdMs} as valid_from_ms,
  null::bigint as valid_to_ms,
  true as is_current,
  ${updatedMs} as updated_at_ms
from ${sqliteScan(sqlitePath, "tasks_current")} t
left join task_titles tt on tt.task_id = t.id;
`.trim();
}

function buildTaskTitleCtes(sqlitePath: string): string {
    // Derives display_title / title_source / title_quality for tasks whose
    // runtime-generated title is unhelpful ("Claude Code — ...",
    // "Codex CLI — ...", "Error: ...", "Subagent:..."). Order:
    //   1. 'Subagent:' tasks inherit parent display_title  -> parent_task
    //   2. runtime-generated + first user prompt captured  -> first_user_prompt
    //   3. runtime-generated + no prompt                   -> runtime_fallback
    //   4. otherwise                                        -> raw
    // Low-signal prompt candidates (SQL echoes, localhost URLs, 'Error:'
    // bodies) are ranked last so a genuine human prompt wins.
    const promptCreatedMs = dateMsExpression("created_at");
    return `
prompt_candidates as (
  select
    task_id,
    ${promptCreatedMs} as created_at_ms,
    regexp_replace(
      trim(coalesce(nullif(body, ''), nullif(title, ''))),
      '[[:space:]]+',
      ' ',
      'g'
    ) as prompt_title
  from ${sqliteScan(sqlitePath, "timeline_events_view")}
  where kind in ('user.message', 'prompt.submitted')
),
ranked_prompt_candidates as (
  select
    task_id,
    prompt_title,
    row_number() over (
      partition by task_id
      order by
        case
          when lower(prompt_title) like 'error:%' then 100
          when lower(prompt_title) like 'data table%' then 90
          when lower(prompt_title) like 'generate 0 to 3 ambient suggestions%' then 90
          when lower(prompt_title) like 'select %' then 80
          when lower(prompt_title) like 'with %' then 80
          when lower(prompt_title) like 'http://localhost:%' then 70
          else 0
        end,
        created_at_ms
    ) as prompt_rank
  from prompt_candidates
  where prompt_title is not null
    and length(prompt_title) > 0
    and lower(prompt_title) not in ('/exit', 'exit')
),
best_prompt_titles as (
  select
    task_id,
    prompt_title
  from ranked_prompt_candidates
  where prompt_rank = 1
),
task_title_base as (
  select
    t.id as task_id,
    t.title as raw_title,
    t.task_kind,
    t.parent_task_id,
    coalesce(t.cli_source, 'unknown') as runtime_source,
    p.prompt_title,
    case
      when t.title like 'Claude Code — %' then true
      when t.title like 'Codex CLI — %' then true
      when lower(t.title) like 'error:%' then true
      when t.title like 'Subagent:%' then true
      else false
    end as is_generated_title
  from ${sqliteScan(sqlitePath, "tasks_current")} t
  left join best_prompt_titles p on p.task_id = t.id
),
primary_task_titles as (
  select
    task_id,
    raw_title,
    task_kind,
    parent_task_id,
    runtime_source,
    prompt_title,
    is_generated_title,
    case
      when is_generated_title and prompt_title is not null and runtime_source = 'codex-cli' then concat('Codex session: ', prompt_title)
      when is_generated_title and prompt_title is not null then prompt_title
      when is_generated_title and runtime_source = 'codex-cli' then 'Codex session (prompt not captured)'
      when is_generated_title and runtime_source = 'claude-plugin' then 'Claude task (prompt not captured)'
      when is_generated_title then 'Runtime task (prompt not captured)'
      else raw_title
    end as primary_display_title
  from task_title_base
),
task_titles as (
  select
    t.task_id,
    t.raw_title,
    case
      when t.raw_title like 'Subagent:%' and p.primary_display_title is not null
        then concat(
          nullif(trim(regexp_replace(t.raw_title, '^Subagent:[[:space:]]*', '')), ''),
          ': ',
          p.primary_display_title
        )
      else t.primary_display_title
    end as display_title,
    case
      when t.raw_title like 'Subagent:%' and p.primary_display_title is not null then 'parent_task'
      when t.is_generated_title and t.prompt_title is not null then 'first_user_prompt'
      when t.is_generated_title then 'runtime_fallback'
      else 'raw'
    end as title_source,
    case
      when t.raw_title like 'Subagent:%' and p.primary_display_title is not null then 'derived'
      when t.is_generated_title and t.prompt_title is not null then 'derived'
      when t.is_generated_title then 'generic'
      else 'raw'
    end as title_quality
  from primary_task_titles t
  left join primary_task_titles p on p.task_id = t.parent_task_id
)`.trim();
}

function buildFactTurnTokensSql(): string {
    // fact_turn_tokens is the turn-grain token fact table — one row per
    // context.snapshot / token.usage event. On Claude Code the snapshot is
    // emitted by StatusLine after each API request, so contextWindow*Tokens
    // carry per-turn input/output/cache values. On Codex those values are
    // duplicated with lastTurn*Tokens. This table lets BI pages chart token
    // cost per individual turn instead of only per task.
    return `
create or replace table fact_turn_tokens as
select
  event_id,
  task_id,
  session_id,
  event_time_ms,
  cast(strftime(event_at, '%Y%m%d') as integer) as time_key,
  event_type,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowInputTokens'),
    json_extract_string(payload_json, '$.metadata.contextWindowInputTokens'),
    json_extract_string(payload_json, '$.lastTurnInputTokens'),
    json_extract_string(payload_json, '$.metadata.lastTurnInputTokens')
  ) as bigint) as input_tokens,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowOutputTokens'),
    json_extract_string(payload_json, '$.metadata.contextWindowOutputTokens'),
    json_extract_string(payload_json, '$.lastTurnOutputTokens'),
    json_extract_string(payload_json, '$.metadata.lastTurnOutputTokens')
  ) as bigint) as output_tokens,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowCacheReadTokens'),
    json_extract_string(payload_json, '$.metadata.contextWindowCacheReadTokens'),
    json_extract_string(payload_json, '$.lastTurnCacheReadTokens'),
    json_extract_string(payload_json, '$.metadata.lastTurnCacheReadTokens')
  ) as bigint) as cache_read_tokens,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowCacheCreationTokens'),
    json_extract_string(payload_json, '$.metadata.contextWindowCacheCreationTokens'),
    json_extract_string(payload_json, '$.lastTurnCacheCreationTokens'),
    json_extract_string(payload_json, '$.metadata.lastTurnCacheCreationTokens')
  ) as bigint) as cache_creation_tokens,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowTotalTokens'),
    json_extract_string(payload_json, '$.metadata.contextWindowTotalTokens')
  ) as bigint) as context_window_total_tokens,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowUsedPct'),
    json_extract_string(payload_json, '$.metadata.contextWindowUsedPct')
  ) as double) as context_used_pct,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.contextWindowSize'),
    json_extract_string(payload_json, '$.metadata.contextWindowSize')
  ) as bigint) as context_window_size,
  try_cast(coalesce(
    json_extract_string(payload_json, '$.costTotalUsd'),
    json_extract_string(payload_json, '$.metadata.costTotalUsd')
  ) as double) as cost_total_usd,
  coalesce(
    json_extract_string(payload_json, '$.modelId'),
    json_extract_string(payload_json, '$.metadata.modelId')
  ) as model_id
from bronze_events_with_archive
where event_type in ('context.snapshot', 'token.usage')
  or lower(event_type) like '%context%'
  or lower(event_type) like '%token%';
`.trim();
}

function buildDimTimeSql(): string {
    return `
create or replace table dim_time as
select distinct
  cast(strftime(event_at, '%Y%m%d') as integer) as time_key,
  cast(event_at as date) as date,
  extract(year from event_at) as year,
  extract(month from event_at) as month,
  extract(day from event_at) as day,
  extract(dow from event_at) as day_of_week
from bronze_events
where event_at is not null;
`.trim();
}

function buildFactTaskSummarySql(): string {
    // fact_task_summary is the task-grain gold table. Most derivations here:
    //   wall_clock_ms     = completed_at_ms - started_at_ms (null if incomplete)
    //   active_ms         = sum(fact_sessions.duration_ms)
    //   idle_ratio        = 1 - active_ms / wall_clock_ms (capped to [0, 1])
    //   outcome           = status normalized to 'success' | 'failure' | <raw status>
    //   retry_count       = number of 'failure' sessions excluding the most
    //                       recent session (row_number() > 1 by started_at desc)
    //   tool_failure_rate = tool_failure_count / tool_call_count
    //   difficulty_score  = ln(1+tool_calls)
    //                       + ln(1+sessions)*1.5
    //                       + compact_count*2
    //                       + tool_failure_rate*10
    //                       + retry_count*3
    // See docs/guide/duckdb-analytics-schema.md § Derived Fields and the BI
    // Glossary page (/glossary) for plain-language explanations.
    return `
create or replace table fact_task_summary as
with task_base as (
  select
    t.task_id,
    t.parent_task_id,
    t.display_title,
    t.task_kind,
    coalesce(t.runtime_source, 'unknown') as runtime_source,
    t.workspace_path,
    t.status,
    case
      when t.status in ('completed', 'success') then 'success'
      when t.status in ('errored', 'error', 'failed', 'failure') then 'failure'
      else t.status
    end as outcome,
    t.valid_from_ms as started_at_ms,
    case
      when t.status in ('completed', 'errored', 'success', 'failed', 'failure', 'error') then t.updated_at_ms
      else null
    end as completed_at_ms
  from dim_task t
  where t.is_current = true
),
session_agg as (
  select
    task_id,
    count(*) as session_count,
    sum(coalesce(duration_ms, 0)) as active_ms,
    sum(case when outcome = 'failure' then 1 else 0 end) as failure_session_count
  from fact_sessions
  group by task_id
),
retry_agg as (
  select
    task_id,
    count(*) as retry_count
  from (
    select
      task_id,
      outcome,
      row_number() over (partition by task_id order by coalesce(started_at_ms, 0) desc) as rn
    from fact_sessions
  ) ranked
  where outcome = 'failure' and rn > 1
  group by task_id
),
tool_agg as (
  select
    task_id,
    count(*) as tool_call_count,
    count(distinct tool_name) as distinct_tool_count,
    sum(case when failed = true or outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) as tool_failure_count,
    sum(case when is_interrupt = true then 1 else 0 end) as tool_interrupt_count,
    sum(case when tool_category = 'file_write' then 1 else 0 end) as write_count,
    sum(case when tool_category = 'file_read' then 1 else 0 end) as read_count,
    sum(case when tool_category = 'file_edit' then 1 else 0 end) as edit_count,
    sum(case when tool_category = 'search' then 1 else 0 end) as search_count,
    sum(case when tool_category = 'shell' then 1 else 0 end) as shell_count,
    sum(case when tool_category in ('web_fetch', 'web_search') then 1 else 0 end) as web_count,
    sum(case when tool_category in ('test_run', 'build_run', 'rule_check') then 1 else 0 end) as verify_count
  from fact_tool_calls
  group by task_id
),
event_agg as (
  select
    task_id,
    count(*) as event_count
  from bronze_events_with_archive
  where task_id is not null
  group by task_id
),
subagent_agg as (
  select
    parent_task_id as task_id,
    count(*) as subagent_count
  from dim_task
  where parent_task_id is not null
    and is_current = true
  group by parent_task_id
),
eval_agg as (
  select
    task_id,
    max(case when scope_kind = 'task' then rating end) as evaluation_rating,
    max(case when scope_kind = 'task' then use_case end) as use_case,
    max(case when scope_kind = 'task' then workflow_tags end) as workflow_tags,
    sum(reuse_count) as reuse_count,
    sum(briefing_copy_count) as briefing_copy_count,
    count(*) as evaluation_count
  from fact_evaluations
  group by task_id
)
select
  b.task_id,
  b.parent_task_id,
  b.display_title,
  b.task_kind,
  b.runtime_source,
  c.model_id,
  b.workspace_path,
  b.started_at_ms,
  b.completed_at_ms,
  case
    when b.completed_at_ms is not null and b.started_at_ms is not null
      then b.completed_at_ms - b.started_at_ms
    else null
  end as wall_clock_ms,
  case
    when b.completed_at_ms is not null
      then cast(strftime(to_timestamp(b.completed_at_ms / 1000.0), '%Y%m%d') as integer)
    else null
  end as completed_time_key,
  coalesce(s.active_ms, 0) as active_ms,
  case
    when b.completed_at_ms is null or b.started_at_ms is null then null
    when (b.completed_at_ms - b.started_at_ms) <= 0 then 0.0
    else round(1.0 - cast(coalesce(s.active_ms, 0) as double) / nullif(b.completed_at_ms - b.started_at_ms, 0), 4)
  end as idle_ratio,
  b.status,
  b.outcome,
  coalesce(sa.subagent_count, 0) > 0 as has_subagent,
  coalesce(sa.subagent_count, 0) as subagent_count,
  coalesce(s.session_count, 0) as session_count,
  coalesce(r.retry_count, 0) as retry_count,
  coalesce(e.event_count, 0) as event_count,
  coalesce(c.user_turn_count, 0) as user_turn_count,
  coalesce(c.assistant_turn_count, 0) as assistant_turn_count,
  coalesce(t.tool_call_count, 0) as tool_call_count,
  coalesce(t.distinct_tool_count, 0) as distinct_tool_count,
  coalesce(t.tool_failure_count, 0) as tool_failure_count,
  coalesce(t.tool_interrupt_count, 0) as tool_interrupt_count,
  case
    when coalesce(t.tool_call_count, 0) = 0 then 0
    else round(cast(t.tool_failure_count as double) / t.tool_call_count, 4)
  end as tool_failure_rate,
  coalesce(t.write_count, 0) as write_count,
  coalesce(t.read_count, 0) as read_count,
  coalesce(t.edit_count, 0) as edit_count,
  coalesce(t.search_count, 0) as search_count,
  coalesce(t.shell_count, 0) as shell_count,
  coalesce(t.web_count, 0) as web_count,
  coalesce(t.verify_count, 0) as verify_count,
  coalesce(c.compact_count, 0) as compact_count,
  coalesce(c.max_context_used_pct, 0) as max_context_used_pct,
  coalesce(c.avg_context_used_pct, 0) as avg_context_used_pct,
  coalesce(c.min_context_remaining_pct, 0) as min_context_remaining_pct,
  coalesce(c.max_context_total_tokens, 0) as max_context_total_tokens,
  coalesce(c.context_window_size, 0) as context_window_size,
  coalesce(c.max_turn_input_tokens, 0) as max_turn_input_tokens,
  coalesce(c.max_turn_output_tokens, 0) as max_turn_output_tokens,
  coalesce(c.sum_turn_input_tokens, 0) as sum_turn_input_tokens,
  coalesce(c.sum_turn_output_tokens, 0) as sum_turn_output_tokens,
  coalesce(c.sum_cache_read_tokens, 0) as sum_cache_read_tokens,
  coalesce(c.sum_cache_creation_tokens, 0) as sum_cache_creation_tokens,
  coalesce(c.max_cost_total_usd, 0) as max_cost_total_usd,
  ev.evaluation_rating,
  ev.use_case,
  ev.workflow_tags,
  coalesce(ev.reuse_count, 0) as reuse_count,
  coalesce(ev.briefing_copy_count, 0) as briefing_copy_count,
  coalesce(ev.evaluation_count, 0) as evaluation_count,
  round(
    ln(1 + coalesce(t.tool_call_count, 0))
      + ln(1 + coalesce(s.session_count, 0)) * 1.5
      + coalesce(c.compact_count, 0) * 2
      + case
          when coalesce(t.tool_call_count, 0) = 0 then 0
          else cast(t.tool_failure_count as double) / t.tool_call_count * 10
        end
      + coalesce(r.retry_count, 0) * 3,
    2
  ) as difficulty_score
from task_base b
left join session_agg s on s.task_id = b.task_id
left join retry_agg r on r.task_id = b.task_id
left join tool_agg t on t.task_id = b.task_id
left join event_agg e on e.task_id = b.task_id
left join fact_task_context c on c.task_id = b.task_id
left join subagent_agg sa on sa.task_id = b.task_id
left join eval_agg ev on ev.task_id = b.task_id;
`.trim();
}

function buildEtlMetadataSql(sourceTable: AnalyticsSourceTable): string {
    return `
create table if not exists analytics_etl_runs (
  run_id varchar primary key,
  source_table varchar not null,
  completed_at timestamp not null,
  bronze_event_count bigint not null,
  task_summary_count bigint not null
);

insert into analytics_etl_runs
select
  uuid()::varchar as run_id,
  ${quoteDuckDbString(sourceTable)} as source_table,
  now() as completed_at,
  (select count(*) from bronze_events) as bronze_event_count,
  (select count(*) from fact_task_summary) as task_summary_count;
`.trim();
}

export function buildArchiveOldDomainEventsSql(options: {
    readonly sqlitePath: string;
    readonly archivePath: string;
    readonly archiveBeforeMs: number;
}): readonly string[] {
    const sqlitePath = quoteDuckDbString(options.sqlitePath);
    const archivePath = quoteDuckDbString(options.archivePath);
    return [
        `
copy (
  select
    event_id,
    cast(event_time as bigint) as event_time_ms,
    to_timestamp(cast(event_time as double) / 1000.0) as event_at,
    event_type,
    cast(schema_ver as integer) as schema_ver,
    coalesce(aggregate_id, json_extract_string(payload_json, '$.task_id')) as task_id,
    session_id,
    actor,
    correlation_id,
    causation_id,
    payload_json,
    cast(recorded_at as bigint) as recorded_at_ms,
    to_timestamp(cast(recorded_at as double) / 1000.0) as recorded_at,
    'events' as source_table
  from sqlite_scan(${sqlitePath}, 'events')
  where cast(event_time as bigint) < ${options.archiveBeforeMs}
) to ${archivePath} (format parquet);
`.trim(),
        `
attach ${sqlitePath} as source_sqlite (type sqlite);
delete from source_sqlite.events
where cast(event_time as bigint) < ${options.archiveBeforeMs};
detach source_sqlite;
`.trim(),
    ];
}

export const PORTABLE_ANALYTICS_TABLES = [
    "fact_task_summary",
    "fact_sessions",
    "fact_tool_calls",
    "fact_evaluations",
    "fact_task_context",
    "fact_turn_tokens",
    "dim_task",
    "dim_tool",
    "dim_time",
] as const;

export type PortableAnalyticsTable = (typeof PORTABLE_ANALYTICS_TABLES)[number];

export function buildPortableAnalyticsExportSql(outputDir: string): readonly string[] {
    const normalizedDir = outputDir.replace(/\/+$/g, "");
    return PORTABLE_ANALYTICS_TABLES.map((table) => {
        const outputPath = quoteDuckDbString(`${normalizedDir}/${table}.parquet`);
        return `copy ${table} to ${outputPath} (format parquet);`;
    });
}
