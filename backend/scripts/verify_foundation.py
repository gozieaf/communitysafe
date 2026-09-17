"""Verify the deployed database has PostgreSQL and PostGIS available."""

from sqlalchemy import create_engine, text

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    connect_args = {"sslrootcert": str(settings.pgsslrootcert)} if settings.pgsslrootcert else {}
    engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
    with engine.connect() as connection:
        postgres_version = connection.scalar(text("SHOW server_version"))
        postgis_version = connection.scalar(text("SELECT postgis_version()"))
    print(f"PostgreSQL {postgres_version}; PostGIS {postgis_version}; connection verified")


if __name__ == "__main__":
    main()
