"""Password hashing and session-cookie signing.

The session cookie holds nothing but a signed `{"user_id": ...}` payload — no
server-side session store, matching the design already recommended for this
app in MIGRATION/RESEARCH_STANDALONE_MIGRATION.md §4. Every existing router's
`Depends(get_current_user)` call keeps working unchanged; only
app/core/auth.py's identity source changes (see that module).
"""

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from passlib.context import CryptContext

from app.core.config import get_settings

SESSION_COOKIE_NAME = "session"

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.session_secret_key, salt="college-advisor-session")


def create_session_token(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def read_session_token(token: str) -> int | None:
    """Returns the user_id encoded in the token, or None if missing/invalid/expired."""
    settings = get_settings()
    max_age = settings.session_max_age_days * 24 * 60 * 60
    try:
        data = _serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    user_id = data.get("user_id")
    return user_id if isinstance(user_id, int) else None
