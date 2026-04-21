from pydantic_settings import BaseSettings
import json


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://claude:claude_logs_secret_2026@localhost:5432/claude_logs"
    anthropic_api_url: str = "https://api.anthropic.com"
    admin_api_key: str = "clc_admin_key_change_me"
    cors_origins: str = '["http://localhost:3100"]'
    log_retention_days: int = 90

    @property
    def cors_origins_list(self) -> list[str]:
        return json.loads(self.cors_origins)

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
