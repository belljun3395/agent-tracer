export const INITIAL_ANALYSIS_QUERIES = {
    taskSuccessRateByRuntime30d: `
select
  coalesce(runtime_source, 'unknown') as runtime_source,
  count(*) as task_count,
  sum(case when outcome = 'success' then 1 else 0 end) as success_count,
  round(100.0 * sum(case when outcome = 'success' then 1 else 0 end) / nullif(count(*), 0), 2) as success_rate_pct
from fact_task_summary
where completed_at_ms is not null
  and completed_at_ms >= epoch_ms(cast(current_date as timestamp)) - 2592000000
group by runtime_source
order by task_count desc;
`.trim(),

    averageSessionLengthByTaskKind: `
select
  coalesce(task_kind, 'unknown') as task_kind,
  count(*) as session_count,
  round(avg(duration_ms) / 1000.0, 2) as avg_duration_seconds
from fact_sessions
where duration_ms is not null
group by task_kind
order by avg_duration_seconds desc;
`.trim(),

    toolTop10WithFailureRate: `
select
  coalesce(tool_name, 'unknown') as tool_name,
  count(*) as call_count,
  sum(case when outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) as failed_count,
  round(100.0 * sum(case when outcome in ('failure', 'failed', 'error', 'errored') then 1 else 0 end) / nullif(count(*), 0), 2) as failure_rate_pct
from fact_tool_calls
group by tool_name
order by call_count desc
limit 10;
`.trim(),

    toolCategoryMix: `
select
  coalesce(tool_category, 'other') as tool_category,
  count(*) as call_count,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 2) as share_pct
from fact_tool_calls
group by tool_category
order by call_count desc;
`.trim(),

    difficultyPercentilesByTaskKind: `
select
  coalesce(task_kind, 'unknown') as task_kind,
  count(*) as task_count,
  round(avg(difficulty_score), 2) as avg_difficulty,
  round(quantile_cont(difficulty_score, 0.5), 2) as p50_difficulty,
  round(quantile_cont(difficulty_score, 0.9), 2) as p90_difficulty
from fact_task_summary
where difficulty_score is not null
group by task_kind
order by p90_difficulty desc;
`.trim(),

    goodEvaluationToolDistribution: `
select
  coalesce(tc.tool_name, 'unknown') as tool_name,
  count(*) as call_count,
  count(distinct e.task_id) as evaluated_task_count
from fact_evaluations e
join fact_tool_calls tc on tc.task_id = e.task_id
where e.rating = 'good'
group by tool_name
order by call_count desc, tool_name asc;
`.trim(),
} as const;

export type InitialAnalysisQueryName = keyof typeof INITIAL_ANALYSIS_QUERIES;
