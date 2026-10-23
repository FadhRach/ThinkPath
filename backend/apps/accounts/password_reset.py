"""Atur ulang sandi lewat tautan email sekali pakai.

Permintaan selalu dijawab sama, ada atau tidaknya akun, dan email dikirim di
thread terpisah supaya waktu respons tidak membocorkan keberadaan akun. Tautan
berlaku `PASSWORD_RESET_MINUTES`, hanya yang terbaru yang sah, dan memakainya
mencabut semua sesi login (siapa pun yang sempat memegang token lama terlempar).
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import threading
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.accounts.authentication import revoke_other_sessions
from apps.accounts.models import PasswordResetToken, Profile, normalize_email

logger = logging.getLogger(__name__)

RESEND_GAP = timedelta(seconds=60)
INVALID_LINK = "Tautan atur ulang tidak valid atau sudah kedaluwarsa. Minta tautan baru."


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _run_in_background(work) -> None:
    # shortcut: thread biasa, email hilang bila proses mati saat mengirim; pindahkan ke antrean job bila perlu andal.
    threading.Thread(target=work, daemon=True).start()


def _send(email: str, link: str) -> None:
    try:
        send_mail(
            "Atur ulang kata sandi ThinkPath",
            (
                "Kami menerima permintaan mengatur ulang kata sandi akun ThinkPath ini.\n\n"
                f"Buka tautan berikut (berlaku {settings.PASSWORD_RESET_MINUTES} menit, sekali pakai):\n"
                f"{link}\n\n"
                "Jika bukan kamu yang meminta, abaikan email ini. Kata sandimu tidak berubah."
            ),
            settings.DEFAULT_FROM_EMAIL,
            [email],
        )
    except Exception:  # noqa: BLE001 - kegagalan SMTP tidak boleh tampak ke pemanggil
        logger.exception("Email atur ulang sandi gagal dikirim")


def request_reset(email: str) -> None:
    profile = Profile.objects.filter(email=normalize_email(email)).first()
    if profile is None:
        return
    now = timezone.now()
    if PasswordResetToken.objects.filter(profile=profile, created_at__gt=now - RESEND_GAP).exists():
        return
    token = secrets.token_urlsafe(32)
    with transaction.atomic():
        PasswordResetToken.objects.filter(profile=profile, used_at__isnull=True).update(used_at=now)
        PasswordResetToken.objects.create(
            profile=profile,
            token_hash=_hash(token),
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_MINUTES),
        )
    link = f"{settings.FRONTEND_URL}/reset-sandi?token={token}"
    _run_in_background(lambda: _send(profile.email, link))


def find_valid(token: str) -> PasswordResetToken | None:
    return (
        PasswordResetToken.objects.select_related("profile")
        .filter(token_hash=_hash(token), used_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )


def confirm_reset(row: PasswordResetToken, new_password: str) -> None:
    with transaction.atomic():
        locked = PasswordResetToken.objects.select_for_update().get(pk=row.pk)
        if locked.used_at is not None:
            return
        profile = row.profile
        profile.set_password(new_password)
        profile.save(update_fields=["password"])
        locked.used_at = timezone.now()
        locked.save(update_fields=["used_at"])
        revoke_other_sessions(profile.id)
