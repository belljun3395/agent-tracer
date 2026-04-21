---
title: Task Explorer
---

Every task that completed the ETL pipeline, with headline metrics side by side. Click a row to drill into a single task.

## Tasks

```sql task_rows
select
  task_id,
  case
    when length(display_title) > 80 then substr(display_title, 1, 77) || '...'
    else display_title
  end as title,
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  model_id,
  outcome,
  has_subagent,
  subagent_count,
  session_count,
  tool_call_count,
  tool_failure_count,
  compact_count,
  difficulty_score,
  round(wall_clock_ms / 1000.0, 1) as wall_clock_seconds,
  round(active_ms / 1000.0, 1) as active_seconds,
  completed_at_ms,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_summary
order by coalesce(completed_at_ms, started_at_ms) desc nulls last, task_id
limit 500
```

<DataTable data={task_rows} rows=20 search=true link=task_link>
  <Column id="title" title="Title" />
  <Column id="task_kind" />
  <Column id="runtime_source" />
  <Column id="model_id" />
  <Column id="outcome" />
  <Column id="difficulty_score" title="Difficulty" />
  <Column id="session_count" title="Sessions" />
  <Column id="tool_call_count" title="Tool Calls" />
  <Column id="tool_failure_count" title="Tool Fails" />
  <Column id="compact_count" title="Compacts" />
  <Column id="wall_clock_seconds" title="Wall (s)" />
  <Column id="active_seconds" title="Active (s)" />
  <Column id="has_subagent" title="Subagent?" />
</DataTable>

## Summary by Task Kind

```sql summary_by_kind
select
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  sum(case when outcome = 'success' then 1 else 0 end) as success_count,
  round(sum(case when outcome = 'success' then 1 else 0 end)::double / nullif(count(*), 0), 4) as success_rate_pct,
  round(avg(tool_call_count), 2) as avg_tool_calls,
  round(avg(session_count), 2) as avg_sessions,
  round(avg(difficulty_score), 2) as avg_difficulty
from agent_tracer.fact_task_summary
group by task_kind, runtime_source
order by task_count desc, task_kind, runtime_source
```

<DataTable data={summary_by_kind} />
