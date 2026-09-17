from app.core.config import Settings


def test_cors_origins_are_split_and_trimmed() -> None:
    settings = Settings(database_url="postgresql://example", jwt_secret="x" * 32, cors_origins="https://one.example/, https://two.example")
    assert settings.cors_origins == ["https://one.example", "https://two.example"]
