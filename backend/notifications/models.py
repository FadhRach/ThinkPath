"""Notifikasi di dalam aplikasi untuk dosen dan mahasiswa.

Disimpan per penerima, bukan dihitung ulang tiap kali dibuka, karena status
"sudah dibaca" hanya bisa dilacak pada baris yang benar-benar ada.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from core.models import Profile


class NotificationKind(models.TextChoices):
    # Untuk mahasiswa
    ASSIGNMENT_NEW = "assignment_new", "Tugas baru"
    MATERIAL_NEW = "material_new", "Materi baru"
    SUBMISSION_GRADED = "submission_graded", "Jawaban dinilai"
    SESSION_SCHEDULED = "session_scheduled", "Sesi diskusi dijadwalkan"
    SESSION_CANCELLED = "session_cancelled", "Sesi diskusi dibatalkan"
    DEADLINE_SOON = "deadline_soon", "Tenggat dekat"
    # Untuk dosen
    SUBMISSIONS_NEW = "submissions_new", "Pengumpulan baru"
    STUDENTS_JOINED = "students_joined", "Mahasiswa bergabung"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    kind = models.CharField(max_length=32, choices=NotificationKind.choices)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=300, blank=True, default="")
    # Rute frontend yang dibuka ketika notifikasi diklik.
    link = models.CharField(max_length=300, blank=True, default="")
    # Waktu yang dibicarakan notifikasi, misalnya tenggat atau jadwal sesi.
    # Disimpan sebagai waktu, tidak dirakit ke dalam kalimat: backend berjalan
    # pada UTC dan jam hanya boleh diformat di frontend, di zona pembacanya.
    event_at = models.DateTimeField(null=True, blank=True)
    # Kunci penggabung. Notifikasi berkunci sama yang belum dibaca digabung
    # ("3 pengumpulan baru"), dan pengingat tenggat hanya dikirim sekali.
    group_key = models.CharField(max_length=120, blank=True, default="")
    count = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications"
        indexes = [
            models.Index(fields=["recipient", "-created_at"], name="notif_recipient_recent_idx"),
            models.Index(fields=["recipient", "group_key"], name="notif_recipient_group_idx"),
        ]
        constraints = [
            # Pengingat tenggat hanya boleh ada satu per mahasiswa per tugas.
            # Pemeriksaan di notify_once saja tidak cukup: lonceng dimuat saat
            # halaman dibuka, saat jendela kembali aktif, dan saat diklik, dan
            # dua permintaan yang tiba bersamaan di worker berbeda sama-sama
            # lolos pemeriksaan itu. Kunci lain sengaja tidak diikat, karena
            # notify_grouped membuat baris baru berkunci sama setelah dibaca.
            models.UniqueConstraint(
                fields=["recipient", "group_key"],
                condition=models.Q(kind="deadline_soon"),
                name="notif_deadline_once",
            ),
        ]

    def __str__(self) -> str:
        return self.title
