/**
 * @module application/ports/rules-catalog
 *
 * 이벤트 분류 규칙 카탈로그 포트.
 */

import type { RulesIndex } from "@monitor/core";

export interface IRulesCatalog {
  getIndex(): RulesIndex;
  reload(): RulesIndex;
}
