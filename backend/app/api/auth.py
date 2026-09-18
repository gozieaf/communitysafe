from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import jwt

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_admin
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, new_refresh_token, refresh_token_digest, verify_password
from app.db.models import RefreshSession, User
from app.schemas.auth import Credentials, ProfileUpdate, SignupCredentials, TokenOut, UserOut
from app.services.verification import digest_code, new_verification_code, send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])
REFRESH_COOKIE = "geoapp_refresh"


def user_out(user: User) -> UserOut:
    needs_username = not user.username or user.username.startswith("user_")
    return UserOut(id=user.id, email=user.email, username=user.username, role=user.role, is_verified=user.is_verified, email_visible=user.email_visible, needs_username=needs_username)


def token_response(response: Response, user: User, db: DbSession) -> TokenOut:
    settings = get_settings()
    raw_refresh = new_refresh_token()
    db.add(RefreshSession(token_digest=refresh_token_digest(raw_refresh), user_id=user.id, expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)))
    db.commit()
    response.set_cookie(REFRESH_COOKIE, raw_refresh, max_age=settings.refresh_token_expire_days * 86400, httponly=True, secure=settings.cookie_secure, samesite=settings.cookie_samesite, path="/auth")
    return TokenOut(access_token=create_access_token(str(user.id), user.role), user=user_out(user))


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupCredentials, response: Response, db: DbSession) -> TokenOut:
    if db.scalar(select(User.id).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if db.scalar(select(User.id).where(User.username == payload.username)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already registered")
    user = User(email=payload.email.lower(), username=payload.username, password_hash=hash_password(payload.password))
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


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_profile(payload: ProfileUpdate, user: CurrentUser, db: DbSession) -> UserOut:
    existing = db.scalar(select(User.id).where(User.username == payload.username, User.id != user.id))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already registered")
    user.username = payload.username
    user.email_visible = payload.email_visible
    db.commit()
    return me(user)


@router.post("/verify/request")
def request_verification(user: CurrentUser, db: DbSession) -> dict[str, str]:
    code = new_verification_code()
    user.verification_code_digest = digest_code(code)
    user.verification_expires_at = datetime.now(UTC) + timedelta(minutes=15)
    user.verification_requested_at = datetime.now(UTC)
    db.commit()
    delivered = send_verification_email(user.email, code)
    result = {"message": "Verification code sent to your email." if delivered else "Email delivery is not configured."}
    if not delivered and get_settings().cookie_secure is False:
        result["development_code"] = code
    return result


@router.post("/verify/confirm")
def confirm_verification(code: str, user: CurrentUser, db: DbSession) -> UserOut:
    if not user.verification_expires_at or user.verification_expires_at <= datetime.now(UTC) or user.verification_code_digest != digest_code(code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid or expired")
    user.is_verified = True
    user.verification_code_digest = None
    user.verification_expires_at = None
    db.commit()
    return me(user)


@router.get("/verify/link", response_model=UserOut)
def verify_link(token: str, db: DbSession) -> UserOut:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "email_verification":
            raise ValueError
        user = db.get(User, UUID(str(payload["sub"])))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link is invalid or expired") from None
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_verified = True
    user.verification_code_digest = None
    user.verification_expires_at = None
    db.commit()
    return me(user)


admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/users")
def list_users(_: Annotated[User, Depends(require_admin)], db: DbSession) -> list[dict]:
    return [{"id": user.id, "username": user.username, "email": user.email, "email_visible": user.email_visible, "is_verified": user.is_verified, "created_at": user.created_at, "verification_requested_at": user.verification_requested_at} for user in db.query(User).order_by(User.created_at.desc()).all()]


@admin_router.get("/users/{user_id}/verification-link")
def verification_link(user_id: UUID, _: Annotated[User, Depends(require_admin)], db: DbSession) -> dict[str, str]:
    user = db.get(User, user_id)
    if user is None or not user.verification_code_digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification request not found")
    token = jwt.encode({"sub": str(user.id), "type": "email_verification", "exp": datetime.now(UTC) + timedelta(minutes=15)}, get_settings().jwt_secret, algorithm="HS256")
    return {"link": f"{get_settings().public_api_url}/auth/verify/link?token={token}"}


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


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: DbSession, refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE)) -> None:
    if refresh_token:
        session = db.scalar(select(RefreshSession).where(RefreshSession.token_digest == refresh_token_digest(refresh_token)))
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.now(UTC)
            db.commit()
    response.delete_cookie(REFRESH_COOKIE, path="/auth")
