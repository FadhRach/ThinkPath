"""Draf jawaban dengan jejak pengerjaan yang dicatat server.

Klien hanya mengirim teks. Server menentukan kapan pengerjaan dimulai dan
menghitung kata dari teks itu sendiri, sehingga mahasiswa tidak bisa
mengarang `started_at` atau kurva pertumbuhan.

Yang TIDAK bisa dicegah tanpa merekam ketikan (dan itu berlebihan terhadap
privasi): skrip yang mengirim teks bertahap selama berjam-jam bisa meniru
kurva yang wajar. Biayanya waktu nyata, bukan satu request, dan lonjakan antar
cuplikan tetap terbaca.
"""
from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone
from uuid import UUID

from apps.academics.models import Assignment, SubmissionDraft
from apps.accounts.models import Profile
from apps.analysis.engines.process_signals import ProgressSample

# Cuplikan dicatat paling sering tiap ini. Penyimpanan otomatis boleh lebih
# sering (teks selalu tersimpan), tetapi kurva tidak dipadati cuplikan rapat
# yang membuat laju antar cuplikan tak terbaca.
SAMPLE_INTERVAL_SECONDS = 20
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
) -> SubmissionDraft | None:
    """Simpan teks dan, bila sudah waktunya, satu cuplikan. None bila belum mulai menulis.

    Teks kosong tidak memulai apa pun: pengerjaan dihitung dari ketikan
    pertama, bukan dari saat halaman tugas dibuka.
    """
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
                        document_id=document_id,
                        started_at=now,
                        samples=[{"t": 0, "w": words}],
                    )
                changed = text != draft.text_answer or document_id != draft.document_id
                if not changed:
                    return draft
                draft.text_answer = text
                draft.document_id = document_id
                offset = max(0, int((now - draft.started_at).total_seconds()))
                last = draft.samples[-1]["t"] if draft.samples else None
                if (
                    len(draft.samples) < MAX_SAMPLES
                    and (last is None or offset - last >= SAMPLE_INTERVAL_SECONDS)
                ):
                    draft.samples = [*draft.samples, {"t": offset, "w": words}]
                draft.save(update_fields=["text_answer", "document_id", "samples", "last_saved_at"])
                return draft
        except IntegrityError:
            # Dua penyimpanan pertama bersamaan: yang kedua kini menemukan barisnya.
            continue
    raise RuntimeError("Draf tidak dapat disimpan.")  # pragma: no cover


def trail_from(draft: SubmissionDraft | None, submitted_at, final_words: int) -> tuple:
    """(started_at, duration_seconds, cuplikan) untuk analisis dan penyimpanan.

    Tanpa draf, server tidak pernah melihat teks ini ditulis: mulai = kumpul,
    durasi 0 (terukur), dan satu-satunya cuplikan adalah teks utuh saat
    dikumpulkan. Dengan draf, cuplikan akhir ditambahkan agar tambahan setelah
    penyimpanan terakhir ikut terbaca.
    """
    started_at = draft.started_at if draft else submitted_at
    duration = max(0, int((submitted_at - started_at).total_seconds()))
    samples = [ProgressSample(offset_seconds=item["t"], word_count=item["w"]) for item in (draft.samples if draft else [])]
    if not samples or samples[-1].offset_seconds < duration:
        samples.append(ProgressSample(offset_seconds=duration, word_count=final_words))
    elif samples[-1].word_count != final_words:
        samples[-1] = ProgressSample(offset_seconds=samples[-1].offset_seconds, word_count=final_words)
    return started_at, duration, tuple(samples)
