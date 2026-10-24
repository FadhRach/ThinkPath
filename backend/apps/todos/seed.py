"""Butir to-do demo untuk mahasiswa pertama. Idempoten (id tetap)."""
from __future__ import annotations

import uuid
from datetime import timedelta

from django.utils import timezone

from apps.todos.models import StudentTodo

_NAMESPACE = uuid.UUID("c0ffee00-0000-4000-8000-0000000070d0")

# (kunci, judul, hari menuju tenggat atau None, selesai)
_ITEMS = [
    ("bab3", "Baca bab 3 Metodologi Penelitian", 2, False),
    ("slide", "Siapkan slide presentasi kelompok", 5, False),
    ("pertanyaan", "Catat pertanyaan untuk konsultasi proposal", None, False),
    ("buku", "Kembalikan buku ke perpustakaan", -1, True),
]


def seed_todos_demo(student) -> int:
    today = timezone.localdate()
    for key, title, days, done in _ITEMS:
        StudentTodo.objects.update_or_create(
            id=uuid.uuid5(_NAMESPACE, key),
            defaults={
                "owner": student,
                "title": title,
                "due_on": None if days is None else today + timedelta(days=days),
                "done": done,
                "done_at": timezone.now() if done else None,
            },
        )
    return len(_ITEMS)
