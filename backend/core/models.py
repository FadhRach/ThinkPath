"""Model profil pengguna ThinkPath.

Identitas dikelola sendiri oleh backend (email + password ter-hash).
Password selalu di-set lewat set_password, tidak pernah disimpan mentah.
"""
from __future__ import annotations

import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone


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


class ConsentAction(models.TextChoices):
    GIVEN = "given", "Diberikan"
    # Pilihan opsional diubah tanpa menarik persetujuan wajib.
    UPDATED = "updated", "Diperbarui"
    WITHDRAWN = "withdrawn", "Ditarik"


class ConsentRecord(models.Model):
    """Bukti persetujuan pemrosesan data pribadi, satu baris per peristiwa.

    UU No. 27 Tahun 2022 mewajibkan persetujuan tertulis atau terekam
    (Pasal 22 ayat (1)) dan mewajibkan pengendali menunjukkan buktinya
    (Pasal 24). Karena itu baris di sini tidak pernah diubah atau ditimpa:
    memberi, mengubah pilihan, dan menarik persetujuan masing-masing menjadi
    baris baru, sehingga riwayatnya utuh dan bisa ditunjukkan kepada pemiliknya.
    Keadaan yang berlaku adalah baris terbaru; lihat core.privacy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="consents",
    )
    action = models.CharField(max_length=16, choices=ConsentAction.choices)
    # Versi kebijakan yang dibaca saat keputusan diambil. Persetujuan untuk
    # versi lama tidak berlaku lagi setelah kebijakannya berubah.
    policy_version = models.CharField(max_length=20)
    # Kunci butir yang disetujui, lihat core.privacy. Kosong saat ditarik.
    items = models.JSONField(default=list, blank=True)
    # Bukan auto_now_add: core.privacy.record_consent menjamin waktunya selalu
    # naik per pengguna, karena keadaan yang berlaku dibaca dari baris terbaru.
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "consent_records"
        indexes = [
            models.Index(fields=["profile", "-created_at"], name="consent_profile_recent_idx"),
        ]
