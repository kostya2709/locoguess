"""Admin-token gate for sensitive endpoints.

When `settings.admin_password` is empty (default), the gate is disabled —
all endpoints pass through. This keeps development and tests untouched.

On a public deploy, set `LOCOGUESS_ADMIN_PASSWORD` and clients must:
  1. POST /api/v1/admin/verify with {"password": "..."} to get a token.
  2. Include it as the `X-Admin-Token` header on admin requests.

Tokens are stored in memory only, so a backend restart invalidates all of
them and everyone must re-verify. Fine for a single-event deployment.
"""

import secrets

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings

# In-memory set of valid session tokens.
_valid_tokens: set[str] = set()


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class VerifyRequest(BaseModel):
    password: str


class VerifyResponse(BaseModel):
    token: str


@router.post("/verify", response_model=VerifyResponse)
def verify_password(body: VerifyRequest) -> VerifyResponse:
    """Check the admin password. Returns a session token if it matches."""
    if not settings.admin_password:
        # Gate disabled — anyone can get a token. Consistent behavior so the
        # frontend doesn't need to know whether the server is gated.
        token = secrets.token_urlsafe(24)
        _valid_tokens.add(token)
        return VerifyResponse(token=token)

    if body.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Неверный пароль")

    token = secrets.token_urlsafe(24)
    _valid_tokens.add(token)
    return VerifyResponse(token=token)


def verify_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    """FastAPI dependency. Enforces a valid admin token when the gate is on."""
    if not settings.admin_password:
        return  # gate disabled — always pass
    if not x_admin_token or x_admin_token not in _valid_tokens:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
