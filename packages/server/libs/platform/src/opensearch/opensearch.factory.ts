import { Client } from "@opensearch-project/opensearch";
import { loadApplicationConfig } from "../config/application.config.loader.js";

export function createOpenSearchClient(): Client {
    const { opensearch } = loadApplicationConfig();
    return new Client({ node: opensearch.node });
}
