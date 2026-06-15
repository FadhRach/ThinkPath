"""Service helpers untuk core.

Diisolasi dari views agar logika upsert profil bisa dipakai ulang
(mis. di management command nanti).
"""
from __future__ import annotations

from uuid import UUID

from .authentication import SupabaseUser
from .models import Profile, Role


def get_or_create_profile(user: SupabaseUser) -> Profile:
    """Ambil profil berdasarkan `sub`; buat baru kalau belum ada.

    Default role baru = teacher (lihat CLAUDE.md §6, tahap 1).
    """
    profile_id = UUID(user.sub)
    profile, created = Profile.objects.get_or_create(
        id=profile_id,
        defaults={
            "email": user.email or "",
            "role": Role.TEACHER,
        },
    )
    # Sinkronkan email kalau berubah di Supabase (mis. user ganti email).
    if not created and user.email and profile.email != user.email:
        profile.email = user.email
        profile.save(update_fields=["email"])
    return profile
