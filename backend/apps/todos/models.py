"""Daftar to-do pribadi mahasiswa.

Murni catatan milik pemiliknya: tidak terkait kelas, tugas, atau dosen, dan tidak
pernah dibaca siapa pun selain pemilik. Ikut terhapus bersama akunnya (CASCADE).
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from apps.accounts.models import Profile


class StudentTodo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="todos")
    title = models.CharField(max_length=200)
    # Tanggal saja, tanpa jam: butir pribadi tidak butuh zona waktu.
    due_on = models.DateField(null=True, blank=True)
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "student_todos"
        indexes = [models.Index(fields=["owner", "done", "-created_at"], name="todo_owner_state_idx")]
