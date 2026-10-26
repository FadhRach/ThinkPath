"""Butir to-do demo untuk mahasiswa pertama. Idempoten (id tetap)."""
from __future__ import annotations

import uuid
from datetime import timedelta

from django.utils import timezone

from apps.todos.models import StudentTodo

_NAMESPACE = uuid.UUID("c0ffee00-0000-4000-8000-0000000070d0")

# (kunci, judul, hari menuju tenggat atau None, selesai)
_ITEMS = [
    ("rekursi", "Latihan soal rekursi sebelum asistensi", 2, False),
    ("colab", "Rapikan notebook Colab decision tree", 4, False),
    ("pitch", "Bagi tugas slide pitch deck dengan kelompok", 6, False),
    ("strace", "Pasang strace di WSL", None, False),
    ("uts", "Ambil kartu ujian UTS", -2, True),
]


def seed_todos_demo(student) -> int:
    today = timezone.localdate()
    ids = [uuid.uuid5(_NAMESPACE, key) for key, *_ in _ITEMS]
    # Butir dari versi seed sebelumnya (dan coretan saat demo) dibuang supaya daftarnya rapi.
    StudentTodo.objects.filter(owner=student).exclude(id__in=ids).delete()
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
