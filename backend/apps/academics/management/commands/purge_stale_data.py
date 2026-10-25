"""Sapu data yang tidak punya pemilik atau sudah tidak berguna.

    python manage.py purge_stale_data [--dry-run]

Dijalankan harian dari cron (deploy/maintenance.sh). Menghapus:
- berkas di MEDIA_ROOT milik profil yang sudah tidak ada, dan berkas yatim
  (unggahan yang tidak pernah dikumpulkan, audio tanpa baris) yang lebih tua
  dari 24 jam; batas itu melindungi unggahan yang baru saja diproses;
- job analisis selesai/gagal/digantikan > 30 hari, notifikasi > 90 hari,
  dan sesi login yang sudah dicabut atau kedaluwarsa > 30 hari.
Audio Cek Paham yang lewat masa simpan 30 hari ditangani purge_cekpaham_audio.
"""
from __future__ import annotations

import os
from datetime import timedelta

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.academics.models import Submission, SubmissionDraft
from apps.accounts.models import AuthSession, Profile
from apps.analysis.models import AnalysisJob, JobStatus
from apps.cekpaham.models import CekPahamAttempt
from apps.notifications.models import Notification

GRACE = timedelta(hours=24)


class Command(BaseCommand):
    help = "Menyapu berkas yatim dan baris lama yang sudah tidak diperlukan."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Hanya laporkan, jangan hapus.")

    def handle(self, *args, dry_run: bool, **options):
        now = timezone.now()
        files = self._sweep_files(now, dry_run)
        counts = {
            "job analisis": AnalysisJob.objects.filter(
                status__in=[JobStatus.DONE, JobStatus.FAILED, JobStatus.SUPERSEDED],
                created_at__lt=now - timedelta(days=30),
            ),
            "notifikasi": Notification.objects.filter(created_at__lt=now - timedelta(days=90)),
            "sesi login": AuthSession.objects.filter(
                expires_at__lt=now - timedelta(days=30)
            ) | AuthSession.objects.filter(revoked_at__lt=now - timedelta(days=30)),
        }
        verb = "akan dihapus" if dry_run else "dihapus"
        self.stdout.write(f"{files} berkas yatim {verb}.")
        for label, queryset in counts.items():
            total = queryset.count()
            if not dry_run:
                queryset.delete()
            self.stdout.write(f"{total} {label} {verb}.")

    def _sweep_files(self, now, dry_run: bool) -> int:
        owners = {str(pk) for pk in Profile.objects.values_list("id", flat=True)}
        documents = {
            str(doc)
            for doc in [
                *Submission.objects.filter(source_document__isnull=False).values_list("source_document", flat=True),
                *SubmissionDraft.objects.filter(document_id__isnull=False).values_list("document_id", flat=True),
            ]
        }
        audio = set(CekPahamAttempt.objects.exclude(audio_path="").values_list("audio_path", flat=True))

        removed = 0
        for top in ("documents", "cekpaham"):
            try:
                folders, _ = default_storage.listdir(top)
            except FileNotFoundError:
                continue
            for folder in folders:
                _, names = default_storage.listdir(f"{top}/{folder}")
                for name in names:
                    path = f"{top}/{folder}/{name}"
                    if top == "documents":
                        unreferenced = name.rpartition(".")[0] not in documents
                    else:
                        unreferenced = path not in audio
                    old = now - default_storage.get_modified_time(path) > GRACE
                    if folder not in owners or (unreferenced and old):
                        removed += 1
                        if not dry_run:
                            default_storage.delete(path)
                if not dry_run:
                    try:
                        os.rmdir(default_storage.path(f"{top}/{folder}"))  # hanya bila sudah kosong
                    except (OSError, NotImplementedError):
                        pass
        return removed
