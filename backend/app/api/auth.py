from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, new_refresh_token, refresh_token_digest, verify_password
from app.db.models import RefreshSession, User
from app.schemas.auth import Credentials, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
REFRESH_COOKIE = "geoapp_refresh"


def token_response(response: Response, user: User, db: DbSession) -> TokenOut:
    settings = get_settings()
    raw_refresh = new_refresh_token()
    db.add(RefreshSession(token_digest=refresh_token_digest(raw_refresh), user_id=user.id, expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)))
    db.commit()
    response.set_cookie(REFRESH_COOKIE, raw_refresh, max_age=settings.refresh_token_expire_days * 86400, httponly=True, secure=settings.cookie_secure, samesite=settings.cookie_samesite, path="/auth")
    return TokenOut(access_token=create_access_token(str(user.id), user.role), user=UserOut(id=user.id, email=user.email, role=user.role))


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(payload: Credentials, response: Response, db: DbSession) -> TokenOut:
    if db.scalar(select(User.id).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return token_response(response, user, db)


@router.post("/login", response_model=TokenOut)
def login(payload: Credentials, response: Response, db: DbSession) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return token_response(response, user, db)


@router.post("/refresh", response_model=TokenOut)
def refresh(response: Response, db: DbSession, refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE)) -> TokenOut:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_digest == refresh_token_digest(refresh_token)))
    if session is None or session.revoked_at is not None or session.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is invalid or expired")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    session.revoked_at = datetime.now(UTC)
    return token_response(response, user, db)
