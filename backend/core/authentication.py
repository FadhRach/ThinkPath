"""Custom DRF authentication untuk Supabase JWT.

Alur:
1. Ambil token dari header Authorization (Bearer <jwt>).
2. Decode pakai SUPABASE_JWT_SECRET (HS256, audience "authenticated").
3. Bungkus klaim ke dataclass SupabaseUser (bukan django.contrib.auth.User
   karena kita tidak ingin tabel auth_user ikut mengelola identitas).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


@dataclass(frozen=True)
class SupabaseUser:
    """Representasi minimal user yang sudah terverifikasi via Supabase JWT."""

    sub: str
    email: str
    role: Optional[str] = None

    @property
    def is_authenticated(self) -> bool:
        return True


def _extract_bearer_token(request) -> Optional[str]:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.lower().startswith("bearer "):
        return None
    return header.split(" ", 1)[1].strip() or None


def _decode_supabase_jwt(token: str) -> dict:
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise AuthenticationFailed("SUPABASE_JWT_SECRET belum diset di server.")
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=[settings.SUPABASE_JWT_ALGORITHM],
            audience=settings.SUPABASE_JWT_AUDIENCE,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationFailed("Token kedaluwarsa.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationFailed("Token tidak valid.") from exc


class SupabaseJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = _extract_bearer_token(request)
        if not token:
            return None

        claims = _decode_supabase_jwt(token)
        sub = claims.get("sub")
        if not sub:
            raise AuthenticationFailed("Klaim sub tidak ditemukan di token.")

        user = SupabaseUser(
            sub=str(sub),
            email=str(claims.get("email") or ""),
            role=claims.get("role"),
        )
        return (user, None)

    def authenticate_header(self, request) -> str:
        return "Bearer"
