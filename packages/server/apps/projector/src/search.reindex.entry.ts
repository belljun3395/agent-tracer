import { createOpenSearchClient } from "@monitor/platform";
import { SearchReindexUseCase } from "~projector/domain/index/application/search.reindex.usecase.js";
import { OpenSearchIndexAdapter } from "~projector/domain/index/adapter/open.search.index.adapter.js";

const alias = process.argv[2];
if (alias === undefined) {
    process.stderr.write("사용법: npm run search:reindex -- <alias>  (예: events, tasks, recipes)\n");
    process.exit(1);
}

const client = createOpenSearchClient();
const usecase = new SearchReindexUseCase(new OpenSearchIndexAdapter(client));
const result = await usecase.execute(alias);

if (!result.migrated) {
    process.stdout.write(`[search-reindex] ${result.alias}는 이미 ${result.toIndex}를 가리킨다. 할 일이 없다\n`);
} else {
    process.stdout.write(
        `[search-reindex] ${result.alias}: ${result.fromIndex}(${result.sourceCount}건) -> ${result.toIndex}(${result.targetCount}건)로 alias를 스왑했다\n`,
    );
}
