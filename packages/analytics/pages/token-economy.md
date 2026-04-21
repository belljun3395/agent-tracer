---
title: Token Economy
---

Per-turn token and cost tracking. For Claude Code, the StatusLine emits a `context.snapshot` on every API call, so each row captures **exactly what went into one turn**. Codex `lastTurn*Tokens` is mapped onto the same columns so both runtimes are directly comparable.

## Overview (All Turns)

```sql token_overview
select
  count(*) as turn_events,
  count(distinct task_id) as tasks_with_turns,
  sum(input_tokens) as total_input_tokens,
  sum(output_tokens) as total_output_tokens,
  sum(cache_read_tokens) as total_cache_read_tokens,
  sum(cache_creation_tokens) as total_cache_creation_tokens,
  round(max(cost_total_usd), 4) as max_cost_observed_usd,
  round(avg(input_tokens), 1) as avg_input_per_turn,
  round(avg(output_tokens), 1) as avg_output_per_turn
from agent_tracer.fact_turn_tokens
```

<Grid cols=3>
  <BigValue data={token_overview} value=turn_events title="Turn Events" />
  <BigValue data={token_overview} value=total_input_tokens title="Total Input Tokens" />
  <BigValue data={token_overview} value=total_output_tokens title="Total Output Tokens" />
  <BigValue data={token_overview} value=total_cache_read_tokens title="Cache Read Tokens" />
  <BigValue data={token_overview} value=max_cost_observed_usd title="Max Cost Seen (USD)" fmt=usd4 />
  <BigValue data={token_overview} value=avg_input_per_turn title="Avg Input / Turn" />
</Grid>

## Per-Task Token Footprint

```sql per_task_tokens
select
  s.task_id,
  case
    when length(coalesce(c.title, '')) > 80 then substr(c.title, 1, 77) || '...'
    else coalesce(c.title, '(untitled)')
  end as title,
  coalesce(s.runtime_source, 'unknown') as runtime_source,
  coalesce(s.model_id, 'unknown') as model_id,
  s.max_turn_input_tokens,
  s.max_turn_output_tokens,
  s.sum_turn_input_tokens,
  s.sum_turn_output_tokens,
  s.sum_cache_read_tokens,
  s.sum_cache_creation_tokens,
  round(s.max_cost_total_usd, 4) as max_cost_total_usd,
  s.compact_count,
  '/tasks/' || s.task_id as task_link
from agent_tracer.fact_task_summary s
left join agent_tracer.fact_task_context c on c.task_id = s.task_id
where s.sum_turn_input_tokens > 0
order by s.max_cost_total_usd desc nulls last, s.sum_turn_input_tokens desc
limit 100
```

<DataTable data={per_task_tokens} link=task_link rows=20 />

## Per-Model Turn Distribution

```sql per_model_turns
select
  coalesce(model_id, 'unknown') as model_id,
  count(*) as turn_events,
  count(distinct task_id) as task_count,
  round(avg(input_tokens), 1) as avg_input_tokens,
  round(avg(output_tokens), 1) as avg_output_tokens,
  round(quantile_cont(input_tokens, 0.5), 0) as p50_input,
  round(quantile_cont(input_tokens, 0.9), 0) as p90_input,
  round(quantile_cont(output_tokens, 0.9), 0) as p90_output,
  sum(cache_read_tokens) as total_cache_read,
  sum(cache_creation_tokens) as total_cache_creation,
  round(max(cost_total_usd), 4) as max_cost_observed_usd
from agent_tracer.fact_turn_tokens
where input_tokens is not null
group by model_id
order by turn_events desc, model_id
```

<DataTable data={per_model_turns} />

<BarChart
  data={per_model_turns}
  x=model_id
  y=avg_input_tokens
  title="Avg input tokens per turn — by model"
/>

<BarChart
  data={per_model_turns}
  x=model_id
  y=avg_output_tokens
  title="Avg output tokens per turn — by model"
/>

## Cache Hit Efficiency

`cache_read / (input + cache_read)`. Higher values mean prompt caching is landing. Useful for checking whether Claude Code's prompt caching is actually effective.

```sql cache_efficiency
select
  coalesce(model_id, 'unknown') as model_id,
  count(*) as turn_events,
  sum(input_tokens) as total_input,
  sum(cache_read_tokens) as total_cache_read,
  sum(cache_creation_tokens) as total_cache_creation,
  round(
    sum(cache_read_tokens)::double
      / nullif(sum(cache_read_tokens) + sum(input_tokens), 0),
    4
  ) as cache_hit_ratio
from agent_tracer.fact_turn_tokens
where input_tokens is not null
group by model_id
having sum(input_tokens) + sum(cache_read_tokens) > 0
order by turn_events desc
```

<DataTable data={cache_efficiency} />

<BarChart
  data={cache_efficiency}
  x=model_id
  y=cache_hit_ratio
  yFmt=pct1
  title="Cache hit ratio — by model"
/>

## Biggest Turns

Turns with the largest input token counts. Likely long conversations or moments right before a compact.

```sql biggest_turns
select
  event_time_ms,
  task_id,
  coalesce(model_id, 'unknown') as model_id,
  input_tokens,
  output_tokens,
  cache_read_tokens,
  cache_creation_tokens,
  context_window_total_tokens,
  round(context_used_pct, 2) as context_used_pct,
  round(cost_total_usd, 4) as cost_total_usd,
  '/tasks/' || task_id as task_link
from agent_tracer.fact_turn_tokens
where input_tokens is not null
order by input_tokens desc nulls last
limit 50
```

<DataTable data={biggest_turns} link=task_link rows=20 />
