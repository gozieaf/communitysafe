from fastapi import APIRouter

from app.api.deps import DbSession
from app.db.models import User

router = APIRouter(prefix="/members", tags=["members"])


@router.get("")
def list_members(db: DbSession) -> list[dict]:
    return [{"username": user.username, "email": user.email if user.email_visible else None, "email_visible": user.email_visible, "is_verified": user.is_verified, "created_at": user.created_at} for user in db.query(User).order_by(User.created_at.desc()).all()]