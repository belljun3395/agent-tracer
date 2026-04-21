---
title: Subagent Usage
---

Visibility into when parent tasks delegate to subagents, and whether the delegation pays off.

## Delegation Rate

```sql subagent_mix
select
  case when has_subagent then 'with_subagent' else 'without_subagent' end as cohort,
  count(*) as task_count,
  sum(case when outcome = 'success' then 1 else 0 end) as success_count,
  round(sum(case when outcome = 'success' then 1 else 0 end)::double / nullif(count(*), 0), 4) as success_rate_pct,
  round(avg(tool_call_count), 2) as avg_tool_calls,
  round(avg(wall_clock_ms) / 1000.0, 2) as avg_wall_clock_seconds,
  round(avg(difficulty_score), 2) as avg_difficulty
from agent_tracer.fact_task_summary
where task_kind != 'background' or task_kind is null
group by cohort
order by cohort
```

<BarChart
  data={subagent_mix}
  x=cohort
  y=success_rate_pct
  yFmt=pct1
  title="Success rate: with vs without subagent"
/>

<DataTable data={subagent_mix} />

## Parent Tasks Using Subagents Most

```sql parent_heavy
select
  task_id,
  case
    when length(display_title) > 80 then substr(display_title, 1, 77) || '...'
    else display_title
  end as title,
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  outcome,
  subagent_count,
  session_count,
  tool_call_count,
  difficulty_score,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_summary
where subagent_count > 0
order by subagent_count desc, tool_call_count desc
limit 50
```

<DataTable data={parent_heavy} link=task_link />

## Subagent Performance

```sql subagent_detail
select
  child.task_id,
  case
    when length(child.display_title) > 80 then substr(child.display_title, 1, 77) || '...'
    else child.display_title
  end as title,
  child.outcome,
  child.runtime_source,
  child.tool_call_count,
  child.session_count,
  round(child.wall_clock_ms / 1000.0, 1) as wall_clock_seconds,
  child.difficulty_score,
  case
    when length(parent.display_title) > 60 then substr(parent.display_title, 1, 57) || '...'
    else parent.display_title
  end as parent_title,
  '/tasks/' || child.task_id as task_link
from agent_tracer.fact_task_summary child
left join agent_tracer.fact_task_summary parent on parent.task_id = child.parent_task_id
where child.parent_task_id is not null
order by child.started_at_ms desc nulls last
limit 100
```

<DataTable data={subagent_detail} link=task_link />
