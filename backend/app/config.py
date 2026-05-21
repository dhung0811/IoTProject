from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    rabbitmq_queue: str = "health_metrics"
    rabbitmq_exchange: str = "health_metrics_fanout"
    app_env: str = "development"
    gemini_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
