"""Model profil pengguna ThinkPath.

Identitas dikelola sendiri oleh backend (email + password ter-hash).
Password selalu di-set lewat set_password, tidak pernah disimpan mentah.
"""
from __future__ import annotations

import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models


class Role(models.TextChoices):
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"


class EducationLevel(models.TextChoices):
    """Jenjang studi mahasiswa.

    Sebelumnya berisi SD, SMP, dan SMA-SMK. Fokus produk dipindahkan ke
    mahasiswa, sehingga populasi yang dianalisis seragam dan kalibrasi model
    tidak perlu berbeda per jenjang sekolah.

    Nama kelas dipertahankan agar impor di academics dan serializers tidak
    berubah. Hanya pilihannya yang diganti.
    """

    D3 = "D3", "D3"
    S1 = "S1", "S1"
    S2 = "S2", "S2"
    S3 = "S3", "S3"


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    # Selalu berisi hash (set_password); default kosong hanya untuk migrasi.
    password = models.CharField(max_length=128, default="")
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

    def set_password(self, raw_password: str) -> None:
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password)

    @property
    def label(self) -> str:
        """Nama untuk ditampilkan; email menjadi cadangan bila nama kosong."""
        return self.display_name or self.email

    def __str__(self) -> str:
        return self.label
