"""Layanan akun: daftar, login, dan profil pemanggil.

Diisolasi dari views agar logika akun bisa dipakai ulang
(mis. di management command seeder).
"""
from __future__ import annotations

from uuid import UUID

from django.db import IntegrityError, transaction
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.accounts.models import Profile, normalize_email


def register_profile(
    email: str,
    password: str,
    display_name: str,
    role: str,
    education_level: str = "",
) -> Profile:
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
    except IntegrityError as exc:
        raise ValidationError({"email": ["Email sudah terdaftar."]}) from exc
    return profile


def authenticate_credentials(email: str, password: str) -> Profile | None:
    profile = Profile.objects.filter(email=normalize_email(email)).first()
    if profile is None or not profile.check_password(password):
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
