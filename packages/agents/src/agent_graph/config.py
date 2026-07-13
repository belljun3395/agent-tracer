"""서비스 설정."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    agent_graph_host: str = "0.0.0.0"
    agent_graph_port: int = 8800


@lru_cache
def get_settings() -> Settings:
    return Settings()
