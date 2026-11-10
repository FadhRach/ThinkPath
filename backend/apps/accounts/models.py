"""Profil pengguna ThinkPath: identitas homegrown (email + password ter-hash lewat set_password)."""
from __future__ import annotations

import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class Role(models.TextChoices):
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"


class EducationLevel(models.TextChoices):
    """Jenjang studi mahasiswa (nama kelas dipertahankan agar impor lain tidak berubah)."""

    D3 = "D3", "D3"
    S1 = "S1", "S1"
    S2 = "S2", "S2"
    S3 = "S3", "S3"


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Selalu disimpan lowercase (lihat save); unik tanpa peduli huruf besar.
    email = models.EmailField()
    # Selalu berisi hash (set_password); default kosong hanya untuk migrasi.
    password = models.CharField(max_length=128, default="")
    display_name = models.CharField(max_length=120, blank=True, default="")
    # Tanpa default: peran harus dipilih eksplisit saat mendaftar.
    role = models.CharField(max_length=16, choices=Role.choices)
    # Preferensi di Pengaturan; analisis memakai Class.education_level, bukan kolom ini.
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
        blank=True,
        default="",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "profiles"
        constraints = [
            models.UniqueConstraint(Lower("email"), name="profile_email_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        super().save(*args, **kwargs)

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
    # Hanya ada di riwayat lama, saat pilihan opsional masih bisa diubah.
    UPDATED = "updated", "Diperbarui"
    WITHDRAWN = "withdrawn", "Ditarik"


class ConsentRecord(models.Model):
    """Bukti persetujuan (Pasal 22 ayat (1), Pasal 24 UU PDP): append-only, baris terbaru = keadaan berlaku."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="consents",
    )
    action = models.CharField(max_length=16, choices=ConsentAction.choices)
    # Persetujuan untuk versi lama tidak berlaku lagi setelah kebijakan berubah.
    policy_version = models.CharField(max_length=20)
    # Kunci butir yang disetujui, lihat apps.accounts.privacy. Kosong saat ditarik.
    items = models.JSONField(default=list, blank=True)
    # Asal persetujuan (register, reaccept, withdraw, seed); tidak menyimpan IP.
    source = models.CharField(max_length=16, blank=True, default="")
    # Bukan auto_now_add: record_consent menjamin waktu selalu naik per pengguna (baris terbaru dibaca).
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "consent_records"
        indexes = [
            models.Index(fields=["profile", "-created_at"], name="consent_profile_recent_idx"),
        ]


class AuthSession(models.Model):
    """Satu sesi login; token memuat `sid`, mencabut baris = mencabut token.

    Tidak menyimpan IP/user-agent: kebijakan privasi menjanjikan IP tidak disimpan di DB.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="sessions")
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "auth_sessions"
        indexes = [models.Index(fields=["profile"], name="auth_session_profile_idx")]


class PasswordResetToken(models.Model):
    """Tautan atur-ulang sandi sekali pakai. Yang disimpan hanya hash tokennya,
    jadi isi tabel ini tidak cukup untuk mengambil alih akun."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="reset_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "password_reset_tokens"
        indexes = [models.Index(fields=["profile", "-created_at"], name="pwreset_profile_recent_idx")]


class AccountDeletion(models.Model):
    """Bukti anonim bahwa akun sudah dihapus (hak penghapusan UU PDP): id acak, peran, waktu, jumlah berkas."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=16, choices=Role.choices)
    policy_version = models.CharField(max_length=20, blank=True, default="")
    files_removed = models.PositiveIntegerField(default=0)
    rows_removed = models.PositiveIntegerField(default=0)
    deleted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "account_deletions"
