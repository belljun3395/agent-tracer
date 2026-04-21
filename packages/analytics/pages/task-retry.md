---
title: Task Retry & Failure
---

Tasks that needed multiple session attempts, or whose tool calls failed frequently. These are the best candidates for playbook / agent-behavior improvements.

## Retry Overview

```sql retry_overview
select
  count(*) filter (where retry_count = 0) as tasks_no_retry,
  count(*) filter (where retry_count = 1) as tasks_one_retry,
  count(*) filter (where retry_count >= 2) as tasks_multiple_retries,
  round(avg(retry_count), 3) as avg_retry_count,
  round(avg(tool_failure_rate), 4) as avg_tool_failure_rate
from agent_tracer.fact_task_summary
```

<DataTable data={retry_overview} />

## Retries by Task Kind

```sql retry_by_kind
select
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  sum(case when retry_count > 0 then 1 else 0 end) as retried_task_count,
  round(100.0 * sum(case when retry_count > 0 then 1 else 0 end) / nullif(count(*), 0), 2) as retried_pct,
  round(avg(retry_count), 2) as avg_retry_count,
  round(avg(tool_failure_rate), 4) as avg_tool_failure_rate
from agent_tracer.fact_task_summary
group by task_kind, runtime_source
order by retried_pct desc nulls last, task_count desc
```

<DataTable data={retry_by_kind} />

## Tool Failure Hot Spots

```sql tool_failure_hot
select
  case
    when length(tool_name) > 80 then substr(tool_name, 1, 77) || '...'
    else tool_name
  end as tool_name,
  coalesce(tool_category, 'other') as tool_category,
  count(*) as call_count,
  sum(case when outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) as failed_count,
  round(100.0 * sum(case when outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) / nullif(count(*), 0), 2) as failure_rate_pct,
  count(distinct task_id) as task_count
from agent_tracer.fact_tool_calls
group by tool_name, tool_category
having count(*) >= 5
order by failure_rate_pct desc, call_count desc
limit 50
```

<DataTable data={tool_failure_hot} />

## Worst Offender Tasks

```sql retry_hot
select
  task_id,
  case
    when length(display_title) > 80 then substr(display_title, 1, 77) || '...'
    else display_title
  end as title,
  coalesce(task_kind, 'unknown') as task_kind,
  coalesce(runtime_source, 'unknown') as runtime_source,
  outcome,
  session_count,
  retry_count,
  tool_call_count,
  tool_failure_count,
  tool_failure_rate,
  difficulty_score,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_task_summary
order by
  coalesce(retry_count, 0) desc,
  coalesce(tool_failure_count, 0) desc,
  coalesce(tool_failure_rate, 0) desc,
  coalesce(tool_call_count, 0) desc
limit 50
```

<DataTable data={retry_hot} link=task_link />
