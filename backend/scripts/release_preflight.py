"""Fail fast on unsafe production API configuration before deployment."""

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    problems: list[str] = []
    if settings.jwt_secret.lower().startswith("replace-with") or settings.jwt_secret.lower() == "change_me":
        problems.append("JWT_SECRET is still a placeholder")
    if not settings.cookie_secure:
        problems.append("COOKIE_SECURE must be true in production")
    if settings.cookie_samesite != "none":
        problems.append("COOKIE_SAMESITE must be none for a cross-site Vercel frontend")
    if not settings.cors_origins or "*" in settings.cors_origins:
        problems.append("CORS_ORIGINS must name the production frontend and must not use *")
    if "sslmode=verify-full" not in settings.database_url:
        problems.append("DATABASE_URL must use sslmode=verify-full")
    if settings.pgsslrootcert is None:
        problems.append("PGSSLROOTCERT must point to the Aiven project CA certificate")
    if problems:
        raise SystemExit("Release preflight failed:\n- " + "\n- ".join(problems))
    print("Release preflight passed")


if __name__ == "__main__":
    main()
