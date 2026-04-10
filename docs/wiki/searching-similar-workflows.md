# Searching Similar Workflows

Similar workflow search is a feature that finds past examples close to the current task among past task evaluations.
The current implementation uses a "lexical scoring + optional semantic ranking" structure and works with lexical fallback alone even without semantic search.

## API

- `GET /api/workflows/similar?q=&tags=&limit=`
- `GET /api/workflows/:id/content`
- MCP tool: `monitor_find_similar_workflows`

`/api/workflows/similar` returns a summary for search results + `workflowContext`,
while `/api/workflows/:id/content` returns the full `workflowSnapshot` and `workflowContext` details.

## Current Search Path

`SqliteEvaluationRepository.searchSimilarWorkflows()` internally operates in the following order:

1. Read search rows from combined `task_evaluations`, `monitoring_tasks`, and `timeline_events`.
2. Apply `tags` filter if needed.
3. Calculate lexical score.
4. If embedding service exists, calculate semantic score as well.
5. Combine semantic/lexical results to determine final ranking.
6. For top results, hydrate workflow content and attach `workflowContext`.

## Fields Used in Lexical Score

Current lexical matching is calculated against the following fields:

- Task `title`
- `use_case`
- `workflow_tags`
- `outcome_note`
- `approach_note`
- `reuse_when`
- `watchouts`
- `search_text`

In particular, `search_text` is created during snapshot generation by combining objective, request, outcome, approach, reuse hint, tags, key decisions, key files, etc.

## Semantic Ranking

If embedding service is connected and query is not empty, semantic ranking is added.

- If embedding exists for each evaluation row, cosine similarity is calculated.
- Only results above minimum threshold are considered semantic matches.
- If semantic search fails, only a warning is logged and lexical search is used as fallback.

In other words, semantic search is optional, and the basic safety net is lexical search.

## What is Included in Results

`WorkflowSearchResult` includes the following:

- `taskId`
- `title`
- `displayTitle` optional
- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`
- `rating`
- `eventCount`
- `createdAt`
- `workflowContext`

The search results do not directly include the entire `workflowSnapshot`.
When the client opens the detail view, the full snapshot/context is fetched again via `/api/workflows/:id/content`.

## Query Writing Tips

- Short key terms work better than long natural language sentences.
- Example: `typescript refactor`, `workflow`, `documentation`
- Since lexical fallback always exists, queries with clear tokens and short expressions are better.
- `tags` is an additional substring-based filter, so use it only when confident.

The reason agent management rules keep `tags` empty by default is to avoid unnecessarily reducing recall.

## Why Short Keywords Matter

Current lexical scoring considers both full query match and token-level match against normalized text.
The longer the sentence, the weaker the full match, and increasing token count can shake lexical fallback quality.

Since it must work well even in environments without semantic ranking, short key terms are safest.

## Cost Perspective

- Search rows themselves are read primarily from the evaluation table, but when hydrating results, the full timeline per task is read again.
- Workflow content creation includes `displayTitle` derivation, snapshot generation, and context markdown assembly.
- Embedding creation/storage is asynchronous, and without it or on failure, lexical-only results are returned.

As the library grows, optimizations like search read models, precomputed content, and lazy expansion may become necessary.

## Related Documentation

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
