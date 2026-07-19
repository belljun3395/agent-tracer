"""서비스 설정."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    agent_graph_host: str = "0.0.0.0"
    agent_graph_port: int = 8800

    tracer_db_host: str = "tracer-db"
    tracer_db_port: int = 5432
    tracer_db_name: str = "tracer"
    # 계약인 뷰에만 SELECT가 열린 역할이라 기반 테이블과 쓰기는 데이터베이스가 거부한다.
    agent_db_reader_user: str = "agent_reader"
    agent_db_reader_password: str = "agentreader"

    opensearch_node: str = "http://opensearch:9200"

    def tracer_dsn(self) -> str:
        """읽기 전용 역할로 원장 뷰에 붙는 접속 문자열을 만든다."""
        credentials = f"{self.agent_db_reader_user}:{self.agent_db_reader_password}"
        return f"postgresql://{credentials}@{self.tracer_db_host}:{self.tracer_db_port}/{self.tracer_db_name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
