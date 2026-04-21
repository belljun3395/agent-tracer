---
title: Task Anatomy
---

```sql task_header
select
  task_id,
  display_title,
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  model_id,
  workspace_path,
  outcome,
  status,
  difficulty_score,
  wall_clock_ms,
  round(wall_clock_ms / 1000.0, 1) as wall_clock_seconds,
  round(active_ms / 1000.0, 1) as active_seconds,
  idle_ratio,
  session_count,
  retry_count,
  tool_call_count,
  distinct_tool_count,
  tool_failure_count,
  tool_failure_rate,
  compact_count,
  subagent_count,
  evaluation_rating,
  use_case,
  workflow_tags,
  round(least(100.0, greatest(0.0, max_context_used_pct)) / 100.0, 4) as max_context_used_pct,
  round(least(100.0, greatest(0.0, min_context_remaining_pct)) / 100.0, 4) as min_context_remaining_pct,
  user_turn_count,
  assistant_turn_count,
  event_count,
  started_at_ms,
  completed_at_ms
from agent_tracer.fact_task_summary
where task_id = '${params.task_id}'
```

# {task_header[0].display_title}

<Grid cols=4>
  <BigValue data={task_header} value=outcome title="Outcome" />
  <BigValue data={task_header} value=difficulty_score title="Difficulty" />
  <BigValue data={task_header} value=wall_clock_seconds title="Wall Clock (s)" fmt=num1 />
  <BigValue data={task_header} value=active_seconds title="Active (s)" fmt=num1 />
  <BigValue data={task_header} value=session_count title="Sessions" />
  <BigValue data={task_header} value=retry_count title="Retries" />
  <BigValue data={task_header} value=tool_call_count title="Tool Calls" />
  <BigValue data={task_header} value=tool_failure_rate title="Tool Failure Rate" fmt=pct2 />
  <BigValue data={task_header} value=compact_count title="Compacts" />
  <BigValue data={task_header} value=subagent_count title="Subagents" />
  <BigValue data={task_header} value=max_context_used_pct title="Peak Context %" fmt=pct1 />
  <BigValue data={task_header} value=evaluation_rating title="Evaluation" />
</Grid>

## Metadata

<DataTable data={task_header}>
  <Column id="task_id" />
  <Column id="task_kind" />
  <Column id="runtime_source" />
  <Column id="model_id" />
  <Column id="workspace_path" title="Workspace" />
  <Column id="status" />
  <Column id="use_case" />
  <Column id="workflow_tags" title="Tags" />
</DataTable>

## Tool Category Distribution

```sql tool_category
select
  coalesce(tool_category, 'other') as tool_category,
  count(*) as call_count,
  sum(case when outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) as failed_count,
  round(100.0 * sum(case when outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) / nullif(count(*), 0), 2) as failure_rate_pct,
  round(avg(duration_ms) / 1000.0, 2) as avg_duration_seconds
from agent_tracer.fact_tool_calls
where task_id = '${params.task_id}'
group by tool_category
order by call_count desc, tool_category
```

<BarChart
  data={tool_category}
  x=tool_category
  y=call_count
  title="Tool calls by category"
/>

<DataTable data={tool_category} />

## Sessions

```sql task_sessions
select
  session_id,
  coalesce(phase_guess, 'unknown') as phase_guess,
  outcome,
  status,
  event_count,
  round(duration_ms / 1000.0, 2) as duration_seconds,
  to_timestamp(started_at_ms / 1000.0) as started_at,
  to_timestamp(ended_at_ms / 1000.0) as ended_at
from agent_tracer.fact_sessions
where task_id = '${params.task_id}'
order by started_at_ms
```

<DataTable data={task_sessions} />

## Tool Call Sequence

```sql tool_sequence
select
  row_number() over (order by invoked_at_ms) as step,
  to_timestamp(invoked_at_ms / 1000.0) as invoked_at,
  case
    when length(tool_name) > 80 then substr(tool_name, 1, 77) || '...'
    else tool_name
  end as tool,
  coalesce(tool_category, 'other') as tool_category,
  round(duration_ms / 1000.0, 2) as duration_seconds
from agent_tracer.fact_tool_calls
where task_id = '${params.task_id}'
order by invoked_at_ms
limit 300
```

<DataTable data={tool_sequence} rows=25 />

## Context Pressure

```sql task_context_detail
select
  round(least(100.0, greatest(0.0, max_context_used_pct)) / 100.0, 4) as peak_context_used_pct,
  round(least(100.0, greatest(0.0, min_context_remaining_pct)) / 100.0, 4) as floor_context_remaining_pct,
  compact_count,
  user_turn_count,
  assistant_turn_count,
  max_context_total_tokens,
  context_window_size,
  to_timestamp(latest_context_at_ms / 1000.0) as latest_context_at
from agent_tracer.fact_task_context
where task_id = '${params.task_id}'
```

<DataTable data={task_context_detail} />

## Evaluations

```sql task_evaluations
select
  scope_kind,
  scope_key,
  turn_index,
  rating,
  use_case,
  workflow_tags,
  outcome_note,
  reuse_count,
  briefing_copy_count,
  to_timestamp(evaluated_at_ms / 1000.0) as evaluated_at
from agent_tracer.fact_evaluations
where task_id = '${params.task_id}'
order by evaluated_at_ms desc nulls last, scope_kind
```

<DataTable data={task_evaluations} />

## Subagents

```sql task_subagents
select
  task_id,
  display_title,
  outcome,
  difficulty_score,
  tool_call_count,
  session_count,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_summary
where parent_task_id = '${params.task_id}'
order by started_at_ms
```

<DataTable data={task_subagents} link=task_link />
