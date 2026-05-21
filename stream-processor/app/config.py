from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    rabbitmq_queue: str = "health_metrics"
    rabbitmq_exchange: str = "health_metrics_fanout"

    influxdb_url: str = "http://influxdb:8086"
    influxdb_token: str = "my-super-secret-token"
    influxdb_org: str = "iot"
    influxdb_bucket: str = "health_metrics"

    moving_avg_window: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
