"""Helper HTTP kecil yang dipakai banyak view."""
from __future__ import annotations

from uuid import UUID

from rest_framework.exceptions import NotFound


def parse_uuid_or_404(value: object) -> UUID:
    """ID di URL yang bukan UUID diperlakukan sama dengan ID yang tidak ada."""
    try:
        return UUID(str(value))
    except (ValueError, TypeError) as exc:
        raise NotFound() from exc


def request_user_id(request) -> UUID:
    """UUID profil pemanggil, diambil dari klaim `sub` token (tanpa query DB)."""
    return UUID(request.user.sub)
