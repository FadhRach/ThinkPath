"""Layanan akun: daftar, login, dan profil pemanggil.

Diisolasi dari views agar logika akun bisa dipakai ulang
(mis. di management command seeder).
"""
from __future__ import annotations

from functools import cache
from uuid import UUID

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.accounts.models import ConsentAction, Profile, normalize_email
from apps.accounts.privacy import SOURCE_REGISTER, items_for, record_consent


def register_profile(
    email: str,
    password: str,
    display_name: str,
    role: str,
    education_level: str = "",
    *,
    consent: bool = False,
) -> Profile:
    """Buat akun. `consent=True` mencatat persetujuan di transaksi yang sama,
    sehingga tidak ada akun yang tercipta tanpa buktinya (atau sebaliknya)."""
    profile = Profile(
        email=email,
        display_name=display_name,
        role=role,
        education_level=education_level,
    )
    profile.set_password(password)
    # Pemeriksaan email di serializer bisa kalah balapan dengan pendaftaran
    # serentak; constraint unik di DB yang jadi penentu akhirnya.
    try:
        with transaction.atomic():
            profile.save()
            if consent:
                record_consent(
                    profile.id,
                    ConsentAction.GIVEN,
                    items_for(role),
                    source=SOURCE_REGISTER,
                )
    except IntegrityError as exc:
        raise ValidationError({"email": ["Email sudah terdaftar."]}) from exc
    return profile


@cache
def _dummy_hash() -> str:
    # Dibuat dengan hasher yang sama dengan sandi asli supaya biayanya setara.
    return make_password("kata-sandi-pengganti")


def authenticate_credentials(email: str, password: str) -> Profile | None:
    profile = Profile.objects.filter(email=normalize_email(email)).first()
    if profile is None:
        # Tanpa ini, email yang tidak terdaftar dijawab ±12 ms sedangkan yang
        # terdaftar ±138 ms (diukur), sehingga waktu membocorkan keberadaan akun.
        check_password(password, _dummy_hash())
        return None
    if not profile.check_password(password):
        return None
    return profile


def get_profile_by_sub(sub: str) -> Profile | None:
    try:
        profile_id = UUID(sub)
    except (ValueError, TypeError):
        return None
    return Profile.objects.filter(id=profile_id).first()


def get_request_profile(request) -> Profile:
    """Profil pemilik token, atau 401 bila akunnya sudah tidak ada."""
    profile = get_profile_by_sub(request.user.sub)
    if profile is None:
        raise AuthenticationFailed("Akun tidak ditemukan.")
    return profile
