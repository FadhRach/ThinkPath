"""Autentikasi JWT yang diterbitkan backend sendiri, dengan sesi yang bisa dicabut.

Alur:
1. Login sukses -> backend membuat AuthSession dan menerbitkan JWT HS256 yang
   memuat `sid` sesi itu.
2. Setiap request membawa header Authorization: Bearer <jwt>. Tanda tangan,
   `exp`, `iat`, `sub`, `sid`, `iss`, dan `aud` wajib benar, lalu sesinya harus
   masih berlaku (tidak dicabut, belum kedaluwarsa).
3. Logout dan ganti sandi mencabut sesi, jadi token yang sudah bocor tidak
   hidup sampai kedaluwarsa.
4. Klaim dibungkus dataclass AuthenticatedUser (bukan django.contrib.auth.User
   karena identitas dikelola tabel profiles).

Tiket unggah (`typ: "upload"`) adalah token pendek untuk satu hal saja:
mengunggah/mengambil berkas langsung ke API, melewati batas badan permintaan
fungsi Vercel. Ia ditolak di semua view yang tidak menyatakan
`accepts_upload_ticket = True`.
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import jwt
from django.conf import settings
from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.models import AuthSession, Profile
from apps.accounts.privacy import current_consent

JWT_ALGORITHM = "HS256"
TOKEN_ACCESS = "access"
TOKEN_UPLOAD = "upload"
# Hasil pemeriksaan sesi disimpan sebentar supaya tidak ada query tiap request.
# Logout/ganti sandi menghapus cache-nya di proses ini (1 worker gunicorn).
SESSION_CACHE_SECONDS = 15


@dataclass(frozen=True)
class AuthenticatedUser:
    """Representasi minimal user yang tokennya sudah terverifikasi."""

    sub: str
    email: str
    role: Optional[str] = None
    sid: str = ""
    token_type: str = TOKEN_ACCESS
    # Klaim "consent" sengaja tidak dibawa ke sini. Server tidak boleh
    # memakainya untuk memutuskan apa pun: setelah persetujuan ditarik, token
    # lama di perangkat lain masih memuatnya. Lihat apps.accounts.privacy.

    @property
    def is_authenticated(self) -> bool:
        return True


def signing_key() -> bytes:
    """Kunci tanda tangan JWT, diturunkan dari SECRET_KEY dengan label sendiri.

    Kunci Django (CSRF, dsb.) dan kunci token jadi tidak identik. Dihitung saat
    dipakai, bukan saat import, karena development/test mengganti SECRET_KEY.
    """
    return hmac.new(settings.SECRET_KEY.encode(), b"thinkpath/jwt/v1", hashlib.sha256).digest()


def _session_cache_key(sid: str) -> str:
    return f"auth-session:{sid}"


def start_session(profile: Profile) -> AuthSession:
    now = datetime.now(timezone.utc)
    return AuthSession.objects.create(
        profile=profile,
        created_at=now,
        expires_at=now + timedelta(days=settings.AUTH_TOKEN_LIFETIME_DAYS),
    )


def revoke_session(sid: str | UUID) -> None:
    AuthSession.objects.filter(pk=sid, revoked_at__isnull=True).update(
        revoked_at=datetime.now(timezone.utc)
    )
    cache.delete(_session_cache_key(str(sid)))


def revoke_other_sessions(profile_id: UUID, keep_sid: str | None = None) -> None:
    """Cabut semua sesi aktif profil, kecuali `keep_sid` bila diberikan."""
    others = AuthSession.objects.filter(profile_id=profile_id, revoked_at__isnull=True)
    if keep_sid:
        others = others.exclude(pk=keep_sid)
    for sid in list(others.values_list("pk", flat=True)):
        cache.delete(_session_cache_key(str(sid)))
    others.update(revoked_at=datetime.now(timezone.utc))


def _claims(profile: Profile, sid: str, *, token_type: str, lifetime: timedelta) -> dict:
    now = datetime.now(timezone.utc)
    claims = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(profile.id),
        "sid": str(sid),
        "jti": uuid.uuid4().hex,
        "typ": token_type,
        "iat": now,
        "exp": now + lifetime,
    }
    if token_type == TOKEN_ACCESS:
        consent = current_consent(profile.id)
        claims.update(
            email=profile.email,
            role=profile.role,
            # Dibaca layout frontend untuk memutuskan perlu tidaknya layar
            # persetujuan tanpa panggilan jaringan. Hanya untuk tampilan:
            # pemrosesan data baru tetap memeriksa basis data.
            consent=consent.policy_version if consent else None,
        )
    else:
        claims.update(email=profile.email, role=profile.role)
    return claims


def create_access_token(profile: Profile, sid: str | UUID | None = None) -> str:
    """Token akses. Tanpa `sid` membuka sesi baru; dengan `sid` memperbarui klaim sesi yang sama."""
    sid = str(sid) if sid else str(start_session(profile).pk)
    claims = _claims(
        profile, sid, token_type=TOKEN_ACCESS, lifetime=timedelta(days=settings.AUTH_TOKEN_LIFETIME_DAYS)
    )
    return jwt.encode(claims, signing_key(), algorithm=JWT_ALGORITHM)


def create_upload_ticket(profile: Profile, sid: str) -> str:
    claims = _claims(
        profile, sid, token_type=TOKEN_UPLOAD, lifetime=timedelta(seconds=settings.UPLOAD_TICKET_SECONDS)
    )
    return jwt.encode(claims, signing_key(), algorithm=JWT_ALGORITHM)


def _extract_bearer_token(request) -> Optional[str]:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.lower().startswith("bearer "):
        return None
    return header.split(" ", 1)[1].strip() or None


def _decode_token(token: str) -> dict:
    try:
        # exp, iat, sub, dan sid wajib ada: token tanpa kedaluwarsa atau tanpa
        # sesi tidak boleh lolos hanya karena penandatangannya benar.
        return jwt.decode(
            token,
            signing_key(),
            algorithms=[JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "sid", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationFailed("Token kedaluwarsa.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationFailed("Token tidak valid.") from exc


def _session_is_live(sid: str, sub: str) -> bool:
    key = _session_cache_key(sid)
    cached = cache.get(key)
    if cached is not None:
        return cached == sub
    try:
        session = AuthSession.objects.only("profile_id", "expires_at", "revoked_at").get(pk=sid)
    except (AuthSession.DoesNotExist, ValueError):
        return False
    live = session.revoked_at is None and session.expires_at > datetime.now(timezone.utc)
    if live:
        cache.set(key, str(session.profile_id), SESSION_CACHE_SECONDS)
    return live and str(session.profile_id) == sub


class TokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = _extract_bearer_token(request)
        if not token:
            return None

        claims = _decode_token(token)
        sub, sid = str(claims["sub"]), str(claims["sid"])
        if not _session_is_live(sid, sub):
            raise AuthenticationFailed("Sesi berakhir. Masuk ulang terlebih dahulu.")

        token_type = claims.get("typ", TOKEN_ACCESS)
        if token_type == TOKEN_UPLOAD:
            view = (getattr(request, "parser_context", None) or {}).get("view")
            if not getattr(view, "accepts_upload_ticket", False):
                raise AuthenticationFailed("Tiket unggah tidak berlaku untuk permintaan ini.")
        elif token_type != TOKEN_ACCESS:
            raise AuthenticationFailed("Token tidak valid.")

        user = AuthenticatedUser(
            sub=sub,
            email=str(claims.get("email") or ""),
            role=claims.get("role"),
            sid=sid,
            token_type=token_type,
        )
        return (user, None)

    def authenticate_header(self, request) -> str:
        return "Bearer"
