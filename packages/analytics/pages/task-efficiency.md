---
title: Task Efficiency
---

How many tool calls and how much wall-clock time is spent per task, and how much of that is idle (between sessions).

## Distribution

```sql efficiency_histogram
select
  cast(floor(least(coalesce(tool_call_count, 0), 199) / 10.0) * 10 as integer) as bucket_start,
  count(*) as task_count
from agent_tracer.fact_task_summary
group by bucket_start
order by bucket_start
```

<BarChart
  data={efficiency_histogram}
  x=bucket_start
  y=task_count
  title="Tool calls per task (0-200, 10-wide buckets)"
/>

## Tool Call Intensity by Task Kind

```sql efficiency_by_kind
select
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  round(avg(tool_call_count), 2) as avg_tool_calls,
  round(quantile_cont(tool_call_count, 0.5), 2) as p50_tool_calls,
  round(quantile_cont(tool_call_count, 0.9), 2) as p90_tool_calls,
  round(avg(session_count), 2) as avg_sessions,
  round(avg(wall_clock_ms) / 1000.0, 2) as avg_wall_clock_seconds,
  round(avg(active_ms) / 1000.0, 2) as avg_active_seconds,
  round(avg(idle_ratio), 4) as avg_idle_ratio
from agent_tracer.fact_task_summary
where completed_at_ms is not null
group by task_kind, runtime_source
order by task_count desc, task_kind, runtime_source
```

<DataTable data={efficiency_by_kind} />

## Highest Tool Intensity

```sql top_intensive
select
  task_id,
  case
    when length(display_title) > 80 then substr(display_title, 1, 77) || '...'
    else display_title
  end as title,
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  outcome,
  tool_call_count,
  distinct_tool_count,
  session_count,
  compact_count,
  round(wall_clock_ms / 1000.0, 1) as wall_clock_seconds,
  difficulty_score,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_summary
order by tool_call_count desc nulls last
limit 50
```

<DataTable data={top_intensive} link=task_link />

## Idle Ratio Hot List

Tasks where the agent spent a high proportion of wall-clock time idle between sessions.

```sql idle_hot
select
  task_id,
  case
    when length(display_title) > 80 then substr(display_title, 1, 77) || '...'
    else display_title
  end as title,
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  round(wall_clock_ms / 1000.0, 1) as wall_clock_seconds,
  round(active_ms / 1000.0, 1) as active_seconds,
  round(idle_ratio, 4) as idle_ratio,
  session_count,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_summary
where wall_clock_ms > 60000
  and idle_ratio is not null
order by idle_ratio desc nulls last
limit 50
```

<DataTable data={idle_hot} link=task_link />
