"""Penyimpanan audio jawaban Cek Paham.

    cekpaham/<id mahasiswa>/<id attempt>.<webm|ogg|mp4|mp3>

Hanya dilayani lewat endpoint ber-auth (tidak ada MEDIA_URL). Audio tes mic dan
potongan caption live tidak pernah disimpan.
"""
from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone

from apps.cekpaham.models import CekPahamAttempt

MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_LIVE_CHUNK_BYTES = 1024 * 1024
RETENTION_DAYS = 30

EXTENSIONS = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3"}


def base_mime(content_type: str | None) -> str:
    """'audio/webm;codecs=opus' -> 'audio/webm'; pengirim tidak dipercaya."""
    return (content_type or "").split(";")[0].strip().lower()


def store(student_id: UUID, attempt_id: UUID, data: bytes, mime: str) -> str:
    path = f"cekpaham/{student_id}/{attempt_id}.{EXTENSIONS[mime]}"
    return default_storage.save(path, ContentFile(data))


def open_audio(attempt: CekPahamAttempt):
    """(berkas terbuka, content-type) atau None bila tidak ada lagi."""
    if not attempt.audio_path or not default_storage.exists(attempt.audio_path):
        return None
    return default_storage.open(attempt.audio_path), attempt.audio_mime


def purge_audio(*, days: int = RETENTION_DAYS) -> int:
    """Hapus berkas audio yang lewat masa simpan. Transkrip dan hasil tidak disentuh."""
    cutoff = timezone.now() - timedelta(days=days)
    old = CekPahamAttempt.objects.exclude(audio_path="").filter(created_at__lt=cutoff)
    purged = 0
    for attempt in old:
        if default_storage.exists(attempt.audio_path):
            default_storage.delete(attempt.audio_path)
        attempt.audio_path = ""
        attempt.save(update_fields=["audio_path"])
        purged += 1
    return purged
