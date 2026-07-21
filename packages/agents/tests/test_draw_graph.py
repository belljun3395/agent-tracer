"""그래프 시각화 스크립트가 세 그래프를 그려내는지 검증한다."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def _run_script(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "scripts/draw_graph.py", *args],
        cwd=SERVICE_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def test_문서화된_명령으로_세_그래프를_ASCII_박스로_출력한다() -> None:
    result = _run_script()

    assert result.returncode == 0, result.stderr
    for name in ("recipe-scan", "task-cleanup", "title-suggestion"):
        assert f"## {name}" in result.stdout
    assert result.stdout.count("| investigate |") >= 2


def test_mermaid_옵션으로_세_그래프의_Mermaid를_출력한다() -> None:
    result = _run_script("--mermaid")

    assert result.returncode == 0, result.stderr
    assert result.stdout.count("graph TD") == 3
