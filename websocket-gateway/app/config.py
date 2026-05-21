from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    rabbitmq_exchange: str = "health_metrics_fanout"

    class Config:
        env_file = ".env"


settings = Settings()
