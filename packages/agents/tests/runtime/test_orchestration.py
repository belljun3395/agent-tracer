"""조율자가 워커에게 라운드와 비용을 나누는 공통 규칙을 검증한다."""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from agent_graph.agents.runtime.orchestration import allocate_cost_shares, clamp_rounds


@dataclass
class _Assignment:
    rounds: int


def test_비용_몫은_라운드_비율대로_나뉜다() -> None:
    assignments = [_Assignment(3), _Assignment(1)]

    shares = allocate_cost_shares(assignments)

    assert [share for _assignment, share in shares] == [0.75, 0.25]


def test_라운드_배분이_없으면_거부한다() -> None:
    with pytest.raises(ValueError, match="at least one round"):
        allocate_cost_shares([_Assignment(0), _Assignment(0)])


def test_라운드_축소는_많이_요구한_쪽에_나머지를_돌려준다() -> None:
    assignments = [_Assignment(10), _Assignment(6), _Assignment(4)]

    granted = clamp_rounds(assignments, 14)

    assert sum(granted) == 14
    assert granted == [7, 5, 2]


def test_워커마다_최소_한_라운드는_보존한다() -> None:
    assignments = [_Assignment(10), _Assignment(6), _Assignment(4)]

    granted = clamp_rounds(assignments, 3)

    assert granted == [1, 1, 1]


def test_워커_수가_가용량보다_많으면_거부한다() -> None:
    assignments = [_Assignment(1), _Assignment(1), _Assignment(1)]

    with pytest.raises(ValueError, match="available rounds"):
        clamp_rounds(assignments, 2)
