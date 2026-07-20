"""kernel 골든 계약 픽스처를 읽는다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_FIXTURES_DIR = Path(__file__).parents[3] / "kernel" / "src" / "agent" / "__fixtures__"


def load_contract(name: str) -> dict[str, Any]:
    """kernel 골든 계약 JSON 픽스처 하나를 읽는다."""
    return json.loads((_FIXTURES_DIR / name).read_text(encoding="utf-8"))
