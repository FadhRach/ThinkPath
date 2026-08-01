"""Service helpers untuk core.

Diisolasi dari views agar logika akun bisa dipakai ulang
(mis. di management command seeder).
"""
from __future__ import annotations

from uuid import UUID

from .models import Profile


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
    profile.save()
    return profile


def authenticate_credentials(email: str, password: str) -> Profile | None:
    profile = Profile.objects.filter(email__iexact=email).first()
    if profile is None or not profile.check_password(password):
        return None
    return profile


def get_profile_by_sub(sub: str) -> Profile | None:
    try:
        profile_id = UUID(sub)
    except (ValueError, TypeError):
        return None
    return Profile.objects.filter(id=profile_id).first()
