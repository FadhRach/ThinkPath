"""Generator join_code unik untuk kelas.

Format: 2 huruf + dash + 4 alfanumerik (mis. "K7-9A2B"). Cukup pendek untuk
diingat & diketik siswa.
"""
from __future__ import annotations

import secrets

_PREFIX_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_BODY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_MAX_ATTEMPTS = 8


def generate_unique_join_code() -> str:
    from .models import Class

    for _ in range(_MAX_ATTEMPTS):
        prefix = "".join(secrets.choice(_PREFIX_LETTERS) for _ in range(2))
        body = "".join(secrets.choice(_BODY_CHARS) for _ in range(4))
        code = f"{prefix}-{body}"
        if not Class.objects.filter(join_code=code).exists():
            return code
    raise RuntimeError("Tidak berhasil menggenerate join_code unik setelah beberapa percobaan.")
