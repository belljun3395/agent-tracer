---
title: Runtime Outcomes
---

## Last 30 Days

```sql outcome_summary
select
  count(*) as task_count,
  sum(case when outcome = 'success' then 1 else 0 end) as success_count,
  sum(case when coalesce(outcome, 'unknown') != 'success' then 1 else 0 end) as non_success_count,
  round(sum(case when outcome = 'success' then 1 else 0 end)::double / nullif(count(*), 0), 4) as success_rate_pct,
  round(avg(session_count), 2) as avg_sessions_per_task,
  round(avg(event_count), 2) as avg_events_per_task,
  round(avg(tool_call_count), 2) as avg_tool_calls_per_task,
  round(avg(difficulty_score), 2) as avg_difficulty
from agent_tracer.fact_task_summary
where completed_at_ms is not null
  and completed_at_ms >= epoch_ms(cast(current_date as timestamp)) - 2592000000
```

<BigValue data={outcome_summary} value=task_count title="Tasks" />
<BigValue data={outcome_summary} value=success_rate_pct title="Success Rate" fmt=pct1 />
<BigValue data={outcome_summary} value=avg_difficulty title="Avg Difficulty" />
<BigValue data={outcome_summary} value=avg_tool_calls_per_task title="Avg Tools / Task" />

<DataTable data={outcome_summary} />

## By Runtime

```sql runtime_outcomes
select
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  sum(case when outcome = 'success' then 1 else 0 end) as success_count,
  sum(case when coalesce(outcome, 'unknown') != 'success' then 1 else 0 end) as non_success_count,
  round(sum(case when outcome = 'success' then 1 else 0 end)::double / nullif(count(*), 0), 4) as success_rate_pct,
  round(avg(session_count), 2) as avg_sessions_per_task,
  round(avg(tool_call_count), 2) as avg_tool_calls_per_task,
  round(avg(difficulty_score), 2) as avg_difficulty
from agent_tracer.fact_task_summary
where completed_at_ms is not null
  and completed_at_ms >= epoch_ms(cast(current_date as timestamp)) - 2592000000
group by runtime_source
order by task_count desc, runtime_source
```

<BarChart
  data={runtime_outcomes}
  x=runtime_source
  y=success_rate_pct
  yFmt=pct1
/>

<DataTable data={runtime_outcomes} />

## Task Kind Outcomes

```sql task_kind_outcomes
select
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  sum(case when outcome = 'success' then 1 else 0 end) as success_count,
  sum(case when coalesce(outcome, 'unknown') != 'success' then 1 else 0 end) as non_success_count,
  round(sum(case when outcome = 'success' then 1 else 0 end)::double / nullif(count(*), 0), 4) as success_rate_pct,
  round(avg(wall_clock_ms) / 1000.0, 2) as avg_wall_clock_seconds,
  round(avg(active_ms) / 1000.0, 2) as avg_active_seconds,
  round(avg(session_count), 2) as avg_sessions_per_task,
  round(avg(difficulty_score), 2) as avg_difficulty
from agent_tracer.fact_task_summary
where completed_at_ms is not null
  and completed_at_ms >= epoch_ms(cast(current_date as timestamp)) - 2592000000
group by task_kind, runtime_source
order by task_count desc, task_kind, runtime_source
```

<DataTable data={task_kind_outcomes} />

## Runtime Duration

```sql runtime_duration
select
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  round(avg(wall_clock_ms) / 1000.0, 2) as avg_wall_clock_seconds,
  round(max(wall_clock_ms) / 1000.0, 2) as max_wall_clock_seconds,
  round(avg(active_ms) / 1000.0, 2) as avg_active_seconds,
  round(avg(idle_ratio), 4) as avg_idle_ratio,
  round(avg(session_count), 2) as avg_sessions_per_task
from agent_tracer.fact_task_summary
where completed_at_ms is not null
  and completed_at_ms >= epoch_ms(cast(current_date as timestamp)) - 2592000000
group by runtime_source
order by avg_wall_clock_seconds desc nulls last, task_count desc
```

<DataTable data={runtime_duration} />
