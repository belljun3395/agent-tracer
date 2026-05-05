/**
 * Claude Code Hook: PostToolUse — matcher: "NotebookEdit"
 *
 * NotebookEdit edits Jupyter notebook cells. We funnel into the same
 * file-tool builder so it shows up in the same lane/semantic family as
 * Edit/Write — only the title differs (basename ends in .ipynb).
 */
import {runPostToolUseHook} from "./_shared.js";
import {postFileToolEvent} from "./_file.ops.js";

await runPostToolUseHook("NotebookEdit", postFileToolEvent);
