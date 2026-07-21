"""chat 대화 에이전트의 예산 상수를 소유한다."""

from __future__ import annotations

CHAT_MAX_OUTPUT_TOKENS = 4_000
CHAT_MAX_MODEL_COST_USD = 0.4
# 도구 호출 개수 대신 세는 전역 모델 턴 상한이며 계약 maxTurns의 거울이다.
MAX_MODEL_TURNS = 14

# 한 턴이 langchain agent의 네 슈퍼스텝을 돌므로 재귀 한도는 예산이 아니라 폭주만 끊는 그물이다.
AGENT_RECURSION_LIMIT = 10 * MAX_MODEL_TURNS
