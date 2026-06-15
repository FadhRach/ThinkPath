"""Model profil pengguna ThinkPath.

Profile.id sengaja UUID yang sama dengan klaim `sub` JWT Supabase. Tidak ada
auto-generate karena sumber kebenaran identitas ada di Supabase Auth.
"""
from __future__ import annotations

from django.db import models


class Role(models.TextChoices):
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"


class EducationLevel(models.TextChoices):
    SD = "SD", "SD"
    SMP = "SMP", "SMP"
    SMA_SMK = "SMA-SMK", "SMA/SMK"


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    email = models.EmailField()
    display_name = models.CharField(max_length=120, blank=True, default="")
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.TEACHER,
    )
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
        blank=True,
        default="",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "profiles"

    def __str__(self) -> str:
        return self.display_name or self.email
