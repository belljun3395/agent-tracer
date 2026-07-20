"""title-suggestion 품질 평가기의 오프라인 동작을 검증한다."""

from scripts.evaluate_title_quality import evaluate_title_output, run_offline


def test_체크인한_품질_기준선을_통과한다() -> None:
    assert run_offline() == 0


def test_출력이_없으면_실패로_평가한다() -> None:
    result = evaluate_title_output({"currentTitle": "Untitled"}, None)

    assert result == {
        "key": "title_contract",
        "score": 0,
        "comment": "outputs are missing",
    }


def test_출력_스키마가_틀리면_실패로_평가한다() -> None:
    result = evaluate_title_output(
        {"currentTitle": "Untitled"},
        {"suggestions": [{"title": "좋은 제목"}]},
    )

    assert result["score"] == 0
    assert result["comment"].startswith("output schema validation failed:")
