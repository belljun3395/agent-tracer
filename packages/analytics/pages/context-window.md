---
title: Context Window
---

Token pressure is one of the strongest predictors of an agent going off the rails. These views surface compact events, per-model behavior, and the tasks that sit closest to the limit.

## Overview

```sql context_overview
with clamped as (
  select
    compact_count,
    least(100.0, greatest(0.0, max_context_used_pct)) as max_used_pct_clamped,
    least(100.0, greatest(0.0, min_context_remaining_pct)) as min_remaining_pct_clamped
  from agent_tracer.fact_task_context
)
select
  count(*) as task_count,
  sum(compact_count) as total_compacts,
  round(avg(compact_count), 3) as avg_compacts_per_task,
  round(avg(max_used_pct_clamped) / 100.0, 4) as avg_peak_context_used_pct,
  round(max(max_used_pct_clamped) / 100.0, 4) as worst_peak_context_used_pct,
  round(avg(min_remaining_pct_clamped) / 100.0, 4) as avg_floor_remaining_pct
from clamped
```

<Grid cols=3>
  <BigValue data={context_overview} value=task_count title="Tasks" />
  <BigValue data={context_overview} value=total_compacts title="Total Compacts" />
  <BigValue data={context_overview} value=avg_compacts_per_task title="Avg Compacts / Task" fmt=num2 />
  <BigValue data={context_overview} value=avg_peak_context_used_pct title="Avg Peak Used" fmt=pct1 />
  <BigValue data={context_overview} value=worst_peak_context_used_pct title="Worst Peak Used" fmt=pct1 />
  <BigValue data={context_overview} value=avg_floor_remaining_pct title="Avg Floor Remaining" fmt=pct1 />
</Grid>

## Per-Model Context Pressure

```sql per_model
with clamped as (
  select
    model_id,
    compact_count,
    user_turn_count,
    assistant_turn_count,
    least(100.0, greatest(0.0, max_context_used_pct)) as max_used_pct_clamped,
    least(100.0, greatest(0.0, min_context_remaining_pct)) as min_remaining_pct_clamped
  from agent_tracer.fact_task_context
)
select
  coalesce(model_id, 'unknown') as model_id,
  count(*) as task_count,
  round(avg(max_used_pct_clamped) / 100.0, 4) as avg_peak_used_pct,
  round(max(max_used_pct_clamped) / 100.0, 4) as worst_peak_used_pct,
  round(avg(min_remaining_pct_clamped) / 100.0, 4) as avg_floor_remaining_pct,
  sum(compact_count) as total_compacts,
  round(avg(compact_count), 3) as avg_compacts_per_task,
  sum(user_turn_count) as user_turns,
  sum(assistant_turn_count) as assistant_turns
from clamped
group by model_id
order by task_count desc, model_id
```

<DataTable data={per_model} />

<BarChart
  data={per_model}
  x=model_id
  y=avg_peak_used_pct
  yFmt=pct1
  title="Avg peak context used — by model"
/>

<BarChart
  data={per_model}
  x=model_id
  y=avg_compacts_per_task
  title="Avg compact events per task — by model"
/>

## At-Risk Hot List

Tasks whose peak context usage crossed 80%, or which compacted more than once. These are the most likely candidates for a lost-context failure.

```sql at_risk
select
  c.task_id,
  case
    when length(coalesce(c.title, '')) > 80 then substr(c.title, 1, 77) || '...'
    else coalesce(c.title, '(untitled)')
  end as title,
  coalesce(c.runtime_source, 'unknown') as runtime_source,
  coalesce(c.model_id, 'unknown') as model_id,
  c.status,
  round(least(100.0, greatest(0.0, c.max_context_used_pct)) / 100.0, 4) as max_context_used_pct,
  round(least(100.0, greatest(0.0, c.min_context_remaining_pct)) / 100.0, 4) as min_context_remaining_pct,
  c.compact_count,
  c.user_turn_count,
  c.assistant_turn_count,
  c.max_context_total_tokens,
  c.context_window_size,
  s.outcome,
  s.difficulty_score,
  '/tasks/' || c.task_id as task_link
from agent_tracer.fact_task_context c
left join agent_tracer.fact_task_summary s on s.task_id = c.task_id
where c.max_context_used_pct >= 80 or c.compact_count >= 2
order by c.max_context_used_pct desc, c.compact_count desc
limit 100
```

<DataTable data={at_risk} link=task_link rows=20 />

## All Tasks — Context Usage

```sql task_context
select
  task_id,
  case
    when length(title) > 80 then substr(title, 1, 77) || '...'
    else title
  end as short_title,
  runtime_source,
  model_id,
  status,
  user_turn_count,
  assistant_turn_count,
  compact_count,
  context_event_count,
  round(least(100.0, greatest(0.0, max_context_used_pct)) / 100.0, 4) as peak_context_used_pct,
  round(least(100.0, greatest(0.0, min_context_remaining_pct)) / 100.0, 4) as floor_context_remaining_pct,
  max_context_total_tokens,
  context_window_size,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_context
order by max_context_used_pct desc, compact_count desc, user_turn_count desc, short_title
```

<DataTable data={task_context} link=task_link rows=20 />
