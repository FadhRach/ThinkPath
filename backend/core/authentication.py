"""Custom DRF authentication untuk JWT yang diterbitkan backend sendiri.

Alur:
1. Login sukses -> backend menerbitkan JWT HS256 (ditandatangani SECRET_KEY).
2. Setiap request membawa header Authorization: Bearer <jwt>.
3. Klaim dibungkus dataclass AuthenticatedUser (bukan django.contrib.auth.User
   karena identitas dikelola tabel profiles, bukan auth_user).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import Profile

JWT_ALGORITHM = "HS256"


@dataclass(frozen=True)
class AuthenticatedUser:
    """Representasi minimal user yang tokennya sudah terverifikasi."""

    sub: str
    email: str
    role: Optional[str] = None

    @property
    def is_authenticated(self) -> bool:
        return True


def create_access_token(profile: Profile) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(profile.id),
        "email": profile.email,
        "role": profile.role,
        "iat": now,
        "exp": now + timedelta(days=settings.AUTH_TOKEN_LIFETIME_DAYS),
    }
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def _extract_bearer_token(request) -> Optional[str]:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.lower().startswith("bearer "):
        return None
    return header.split(" ", 1)[1].strip() or None


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationFailed("Token kedaluwarsa.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationFailed("Token tidak valid.") from exc


class TokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = _extract_bearer_token(request)
        if not token:
            return None

        claims = _decode_token(token)
        sub = claims.get("sub")
        if not sub:
            raise AuthenticationFailed("Klaim sub tidak ditemukan di token.")

        user = AuthenticatedUser(
            sub=str(sub),
            email=str(claims.get("email") or ""),
            role=claims.get("role"),
        )
        return (user, None)

    def authenticate_header(self, request) -> str:
        return "Bearer"
