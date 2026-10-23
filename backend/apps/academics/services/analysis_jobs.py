"""Antrean analisis: menyimpan job, mengklaimnya, dan menjalankannya.

Pengumpulan jawaban tidak lagi menunggu Winston dan Groq (sampai ~20 detik).
Ia hanya menyimpan jawaban dan satu AnalysisJob; worker terpisah
(`manage.py run_analysis_worker`) mengerjakannya. Dengan begitu 8 thread
gunicorn tidak bisa dipenuhi oleh lonjakan pengumpulan menjelang tenggat.

Mode inline (settings.ANALYSIS_INLINE, dipakai tes dan runserver lokal)
menjalankan job seketika setelah disimpan, seperti perilaku lama, sehingga
`make dev` tidak butuh proses ketiga.

Konteks proses dan persetujuan dibaca dari basis data SAAT job berjalan, bukan
dibawa dari request. Persetujuan yang ditarik di antara pengumpulan dan
analisis dihormati: analisis jatuh ke heuristik di server sendiri.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.academics.models import AnalysisState, Submission
from apps.academics.selectors import stored_inserted_words, stored_progress
from apps.accounts.privacy import ITEM_EXTERNAL_AI, current_consent
from apps.analysis.engines.process_signals import ProcessContext
from apps.analysis.models import AnalysisJob, AnalysisTrigger, JobStatus
from apps.analysis.pipeline import run_analysis
from apps.analysis.services import record_analysis

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
# Jeda sebelum percobaan ke-2 dan ke-3 setelah galat tak terduga.
RETRY_DELAYS = (timedelta(seconds=5), timedelta(seconds=20))
# Job berstatus running yang tidak selesai selama ini dianggap ditinggal
# worker yang mati dan diambil ulang. Di atas batas terburuk analisis (~20 dtk).
STALE_AFTER = timedelta(seconds=90)


def enqueue(submission: Submission, trigger: str, *, requested_by=None) -> AnalysisJob:
    """Simpan job dan tandai pengumpulan menunggu. Dipanggil di dalam transaksi pemanggil."""
    AnalysisJob.objects.filter(submission=submission, status=JobStatus.QUEUED).update(
        status=JobStatus.SUPERSEDED, finished_at=timezone.now()
    )
    job = AnalysisJob.objects.create(
        submission=submission,
        trigger=trigger,
        requested_by=requested_by,
        revision_count=submission.revision_count,
    )
    Submission.objects.filter(pk=submission.pk).update(analysis_state=AnalysisState.PENDING)
    submission.analysis_state = AnalysisState.PENDING
    return job


def dispatch(job: AnalysisJob) -> None:
    """Jalankan job seketika bila mode inline; bila tidak, biarkan worker yang mengambil."""
    if not getattr(settings, "ANALYSIS_INLINE", False):
        return
    claimed = claim_next(only=job.id)
    if claimed is not None:
        run_job(claimed)


def claim_next(*, only: UUID | None = None, now=None) -> AnalysisJob | None:
    """Ambil satu job yang siap, atau None. Aman dipanggil banyak worker sekaligus."""
    now = now or timezone.now()
    with transaction.atomic():
        ready = Q(status=JobStatus.QUEUED, run_after__lte=now) | Q(
            status=JobStatus.RUNNING, locked_at__lt=now - STALE_AFTER
        )
        jobs = AnalysisJob.objects.select_for_update(skip_locked=True).filter(ready)
        if only is not None:
            jobs = jobs.filter(pk=only)
        job = jobs.order_by("created_at").first()
        if job is None:
            return None
        job.status = JobStatus.RUNNING
        job.locked_at = now
        job.attempts += 1
        job.save(update_fields=["status", "locked_at", "attempts"])
        Submission.objects.filter(pk=job.submission_id).update(analysis_state=AnalysisState.RUNNING)
        return job


def build_process(submission: Submission) -> ProcessContext | None:
    """Konteks proses dari data tersimpan. None untuk jawaban yang diimpor dari dokumen."""
    if submission.is_imported:
        return None
    text = submission.text_answer
    return ProcessContext(
        duration_seconds=submission.duration_seconds,
        revision_count=submission.revision_count,
        word_count=len(text.split()),
        char_count=len(text),
        progress=stored_progress(submission),
        inserted_words=stored_inserted_words(submission),
    )


def _allow_external(submission: Submission) -> bool:
    consent = current_consent(submission.student_profile_id)
    return consent is not None and ITEM_EXTERNAL_AI in consent.items


def _analyse(submission: Submission, *, allow_external: bool) -> tuple[dict, ProcessContext | None]:
    process = build_process(submission)
    analysis = run_analysis(
        submission.text_answer,
        submission.assignment.class_ref.education_level,
        submission.assignment.expected_bloom_level,
        process,
        allow_external=allow_external,
    )
    return analysis, process


def _finish(job: AnalysisJob, status: str, error: str = "") -> None:
    AnalysisJob.objects.filter(pk=job.pk).update(
        status=status, error=error[:300], finished_at=timezone.now(), locked_at=None
    )


def run_job(job: AnalysisJob) -> None:
    """Kerjakan satu job yang sudah diklaim. Tidak pernah melempar."""
    try:
        submission = Submission.objects.select_related(
            "assignment__class_ref", "student_profile"
        ).get(pk=job.submission_id)
    except Submission.DoesNotExist:
        _finish(job, JobStatus.SUPERSEDED, "pengumpulan sudah dihapus")
        return

    if job.trigger != AnalysisTrigger.REANALYZE and submission.revision_count != job.revision_count:
        _finish(job, JobStatus.SUPERSEDED, "teks sudah direvisi lagi")
        return

    try:
        analysis, process = _analyse(submission, allow_external=_allow_external(submission))
        _store(job, submission, analysis, process)
        return
    except Exception as exc:  # noqa: BLE001 - worker tidak boleh mati karena satu job
        logger.exception("Analisis job %s gagal pada percobaan %s", job.id, job.attempts)
        error = f"{type(exc).__name__}: {exc}"

    if job.attempts < MAX_ATTEMPTS:
        delay = RETRY_DELAYS[min(job.attempts - 1, len(RETRY_DELAYS) - 1)]
        AnalysisJob.objects.filter(pk=job.pk).update(
            status=JobStatus.QUEUED, run_after=timezone.now() + delay, locked_at=None, error=error[:300]
        )
        return

    # Percobaan habis: hasil heuristik di server sendiri lebih baik daripada
    # pengumpulan tanpa hasil. Sumbernya tercatat "heuristic", jadi dosen tahu.
    try:
        analysis, process = _analyse(submission, allow_external=False)
        _store(job, submission, analysis, process, note=f"cadangan heuristik: {error}")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cadangan heuristik job %s juga gagal", job.id)
        _finish(job, JobStatus.FAILED, f"{type(exc).__name__}: {exc}")
        Submission.objects.filter(pk=submission.pk).update(analysis_state=AnalysisState.FAILED)


def _store(job: AnalysisJob, submission: Submission, analysis: dict, process, note: str = "") -> None:
    with transaction.atomic():
        locked = Submission.objects.select_for_update().get(pk=submission.pk)
        if job.trigger != AnalysisTrigger.REANALYZE and locked.revision_count != job.revision_count:
            _finish(job, JobStatus.SUPERSEDED, "teks sudah direvisi lagi")
            return
        record_analysis(
            locked, analysis, trigger=job.trigger, process=process, requested_by=job.requested_by
        )
        # Masih ada job lain yang menunggu untuk pengumpulan ini: tetap "pending".
        waiting = AnalysisJob.objects.filter(
            submission=locked, status__in=[JobStatus.QUEUED, JobStatus.RUNNING]
        ).exclude(pk=job.pk).exists()
        Submission.objects.filter(pk=locked.pk).update(
            analysis_state=AnalysisState.PENDING if waiting else AnalysisState.DONE
        )
        _finish(job, JobStatus.DONE, note)
