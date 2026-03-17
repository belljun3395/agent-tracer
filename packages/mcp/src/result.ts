/**
 * @module result
 *
 * MCP 도구 응답 포맷 변환 유틸리티.
 */

import type { SafePostResult } from "./client.js";

/**
 * `SafePostResult`를 MCP 도구 응답 포맷으로 변환한다.
 * `content`에 텍스트 메시지를, `structuredContent`에 전체 결과를 담는다.
 *
 * @param result - {@link SafePostResult} 객체
 * @returns MCP 도구 핸들러가 반환할 수 있는 응답 객체
 */
export function toToolResponse(result: SafePostResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: result.message
      }
    ],
    structuredContent: result
  };
}
