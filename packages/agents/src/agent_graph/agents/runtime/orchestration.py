"""오케스트레이터가 워커 라운드에 비례해 비용을 나누는 공통 규칙."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol


class RoundAssignment(Protocol):
    """워커에게 배분한 모델 라운드를 노출하는 계약."""

    rounds: int


def allocate_cost_shares[Assignment: RoundAssignment](
    assignments: Sequence[Assignment], *, ceiling: float = 1.0
) -> list[tuple[Assignment, float]]:
    """각 워커의 라운드 몫에 예산 상한을 곱해 그 워커가 태울 수 있는 비용과 함께 돌려준다."""
    total_rounds = sum(assignment.rounds for assignment in assignments)
    if total_rounds <= 0:
        raise ValueError("worker assignments must allocate at least one round")
    return [(assignment, ceiling * assignment.rounds / total_rounds) for assignment in assignments]


def clamp_rounds[Assignment: RoundAssignment](assignments: Sequence[Assignment], available: int) -> list[int]:
    """각 워커의 최소 한 라운드를 보존하며 요청 라운드를 가용량에 비례해 줄인다."""
    floor = len(assignments)
    if floor > available:
        # 워커마다 최소 한 라운드를 보장해야 하므로 호출자가 먼저 워커 수를 가용량 이하로 줄여야 한다.
        raise ValueError("available rounds cannot cover one round per assignment")
    requested = sum(assignment.rounds for assignment in assignments)
    spare = max(available - floor, 0)
    over = requested - floor
    granted = [1 + ((assignment.rounds - 1) * spare // over if over else 0) for assignment in assignments]
    priority = sorted(enumerate(assignments), key=lambda pair: pair[1].rounds, reverse=True)
    for position, _assignment in priority[: max(available - sum(granted), 0)]:
        granted[position] += 1
    return granted
