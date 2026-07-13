"""uvicorn 부트스트랩: `python -m agent_graph`."""

from __future__ import annotations

import uvicorn

from .app import app
from .config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(app, host=settings.agent_graph_host, port=settings.agent_graph_port)


if __name__ == "__main__":
    main()
