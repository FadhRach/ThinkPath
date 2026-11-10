"""Draf jawaban: server mencatat waktu mulai dan menghitung kata sendiri (klien hanya mengirim teks).

Batas yang diterima: skrip yang mengirim teks bertahap berjam-jam tetap bisa meniru kurva wajar.
"""
from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone
from uuid import UUID

from apps.academics.models import Assignment, SubmissionDraft
from apps.accounts.models import Profile
from apps.analysis.engines.process_signals import ProgressSample

# Jarak minimum cuplikan: simpan otomatis boleh lebih sering, kurva jangan dipadati.
SAMPLE_INTERVAL_SECONDS = 30
MAX_SAMPLES = 240


def count_words(text: str) -> int:
    return len(text.split())


def get_draft(assignment: Assignment, student: Profile) -> SubmissionDraft | None:
    return SubmissionDraft.objects.filter(
        assignment=assignment, student_profile=student
    ).first()


def save_draft(
    assignment: Assignment,
    student: Profile,
    text: str,
    *,
    document_id: UUID | None = None,
    rich_answer: dict | None = None,
) -> SubmissionDraft | None:
    """Simpan teks + cuplikan bila sudah waktunya; None bila teks kosong (mulai = ketikan pertama)."""
    now = timezone.now()
    words = count_words(text)
    for _ in range(2):
        try:
            with transaction.atomic():
                draft = (
                    SubmissionDraft.objects.select_for_update()
                    .filter(assignment=assignment, student_profile=student)
                    .first()
                )
                if draft is None:
                    if not text.strip():
                        return None
                    return SubmissionDraft.objects.create(
                        assignment=assignment,
                        student_profile=student,
                        text_answer=text,
                        rich_answer=rich_answer,
                        document_id=document_id,
                        started_at=now,
                        samples=[{"t": 0, "w": words}],
                    )
                changed = (
                    text != draft.text_answer
                    or rich_answer != draft.rich_answer
                    or document_id != draft.document_id
                )
                if not changed:
                    return draft
                draft.text_answer = text
                draft.rich_answer = rich_answer
                draft.document_id = document_id
                offset = max(0, int((now - draft.started_at).total_seconds()))
                last = draft.samples[-1]["t"] if draft.samples else None
                if (
                    len(draft.samples) < MAX_SAMPLES
                    and (last is None or offset - last >= SAMPLE_INTERVAL_SECONDS)
                ):
                    draft.samples = [*draft.samples, {"t": offset, "w": words}]
                draft.save(
                    update_fields=["text_answer", "rich_answer", "document_id", "samples", "last_saved_at"]
                )
                return draft
        except IntegrityError:
            # Dua penyimpanan pertama bersamaan: yang kedua kini menemukan barisnya.
            continue
    raise RuntimeError("Draf tidak dapat disimpan.")  # pragma: no cover


def trail_from(draft: SubmissionDraft | None, submitted_at, final_words: int) -> tuple:
    """(started_at, duration_seconds, cuplikan).

    Tanpa draf: mulai = kumpul, durasi 0 terukur, satu cuplikan teks utuh. Dengan draf: cuplikan akhir ditambahkan.
    """
    started_at = draft.started_at if draft else submitted_at
    duration = max(0, int((submitted_at - started_at).total_seconds()))
    samples = [ProgressSample(offset_seconds=item["t"], word_count=item["w"]) for item in (draft.samples if draft else [])]
    if not samples or samples[-1].offset_seconds < duration:
        samples.append(ProgressSample(offset_seconds=duration, word_count=final_words))
    elif samples[-1].word_count != final_words:
        samples[-1] = ProgressSample(offset_seconds=samples[-1].offset_seconds, word_count=final_words)
    return started_at, duration, tuple(samples)
