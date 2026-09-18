import hashlib
import secrets
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings


def new_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def digest_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def send_verification_email(email: str, code: str) -> bool:
    settings = get_settings()
    if not all((settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_from)):
        return False
    message = EmailMessage()
    message["Subject"] = "CommunitySafe email verification"
    message["From"] = settings.smtp_from
    message["To"] = email
    message.set_content(f"Your CommunitySafe verification code is {code}. It expires in 15 minutes.")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    return True