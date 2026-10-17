"""Pembatas laju per pengguna untuk endpoint yang memanggil layanan berbayar."""
from __future__ import annotations

from rest_framework.throttling import ScopedRateThrottle


class PerUserScopedThrottle(ScopedRateThrottle):
    """Seperti ScopedRateThrottle, tetapi per mahasiswa, bukan per alamat IP.

    Satu IP kampus dipakai banyak mahasiswa, jadi batas per IP akan memblokir
    sekelas sekaligus. AuthenticatedUser tidak punya `pk`, kuncinya `sub` token.
    Penghitung di memori proses (LocMemCache), sama seperti throttle login.
    """

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": request.user.sub}
