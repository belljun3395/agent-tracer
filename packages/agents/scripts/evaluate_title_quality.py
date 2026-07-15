"""title-suggestion 출력을 오프라인 기준선이나 LangSmith 실행 기록으로 평가한다."""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any, TypedDict, cast

from langsmith.schemas import Example, Run
from pydantic import ValidationError

from agent_graph.agents.title_suggestion.models import TitleSuggestionDraft
from agent_graph.agents.title_suggestion.policy import validate_title_candidate

DEFAULT_CASES = Path(__file__).parents[1] / "evals" / "title_suggestion_cases.json"


class EvaluationResult(TypedDict):
    """LangSmith와 로컬 실행이 함께 쓰는 평가 결과다."""

    key: str
    score: int
    comment: str


class EvaluationCase(TypedDict):
    """체크인한 평가 입력과 기대 점수를 나타낸다."""

    name: str
    inputs: dict[str, object]
    outputs: dict[str, object]
    expectedScore: int


def evaluate_title_output(
    inputs: Mapping[str, object],
    outputs: Mapping[str, object] | None,
) -> EvaluationResult:
    """제목 출력의 구조와 결정적 도메인 제약을 점수화한다."""
    current_title = inputs.get("currentTitle")
    if not isinstance(current_title, str) or not current_title.strip():
        return _result(["inputs.currentTitle must be a non-empty string"])
    if outputs is None:
        return _result(["outputs are missing"])
    try:
        candidate = TitleSuggestionDraft.model_validate(outputs)
    except ValidationError as error:
        return _result([f"output schema validation failed: {error.errors()[0]['type']}"])
    return _result(validate_title_candidate(candidate, current_title))


def load_cases(path: Path = DEFAULT_CASES) -> list[EvaluationCase]:
    """JSON 파일에서 오프라인 평가 사례를 읽는다."""
    raw: Any = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("evaluation cases must be a JSON array")
    return raw


def run_offline(path: Path = DEFAULT_CASES) -> int:
    """체크인한 사례를 평가하고 기대 점수와 다른 개수를 반환한다."""
    failures = 0
    for case in load_cases(path):
        result = evaluate_title_output(case["inputs"], case["outputs"])
        passed = result["score"] == case["expectedScore"]
        status = "PASS" if passed else "FAIL"
        print(f"{status} {case['name']}: {result['comment']}")
        failures += not passed
    return failures


def run_langsmith(experiment: str) -> None:
    """기존 LangSmith 실험의 출력에 결정적 평가기를 적용한다."""
    from langsmith.evaluation import evaluate

    def evaluator(run: Run, example: Example | None) -> dict[Any, Any]:
        raw_inputs = example.inputs if example is not None else run.inputs
        inputs = cast(Mapping[str, object], raw_inputs or {})
        outputs = cast(Mapping[str, object] | None, run.outputs)
        return dict(evaluate_title_output(inputs, outputs))

    evaluate(experiment, evaluators=[evaluator])


def _result(errors: list[str]) -> EvaluationResult:
    return {
        "key": "title_contract",
        "score": 0 if errors else 1,
        "comment": "; ".join(errors) if errors else "deterministic title contract passed",
    }


def main() -> None:
    """기본은 오프라인 평가를 수행하고 옵션이 있으면 LangSmith 기록을 평가한다."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--langsmith-experiment")
    args = parser.parse_args()
    if args.langsmith_experiment:
        run_langsmith(args.langsmith_experiment)
        return
    raise SystemExit(1 if run_offline(args.cases) else 0)


if __name__ == "__main__":
    main()
