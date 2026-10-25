"""Alur pengumpulan jawaban: submit pertama, revisi, dan permintaan analisis ulang.

Ketiganya hanya MENYIMPAN jawaban dan memasukkan job ke antrean; analisis
(bisa ~20 detik: Winston + Groq) dikerjakan worker (lihat analysis_jobs.py).
Satu fungsi pembangun konteks proses (analysis_jobs.build_process) dipakai
semua jalur, jadi tidak ada jalur yang diam-diam memakai konteks berbeda.
"""
from __future__ import annotations

from collections import Counter
from datetime import timedelta
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.academics.models import (
    AnalysisState,
    Assignment,
    EventType,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
)
from apps.academics.services import analysis_jobs
from apps.academics.limits import MAX_ANSWER_CHARS, MIN_ANSWER_WORDS
from apps.academics.services.documents import (
    combine_with_document,
    read_text,
    verified_source,
)
from apps.academics.services.drafts import count_words, get_draft, trail_from
from apps.accounts.models import Profile
from apps.accounts.privacy import ITEM_EXTERNAL_AI, current_consent
from apps.analysis.models import AnalysisJob, AnalysisTrigger

ALREADY_GRADED = "Jawaban sudah dinilai dosen dan tidak bisa direvisi."


def require_student_consent(student_id: UUID, message: str) -> bool:
    """Persetujuan mahasiswa yang berlaku, atau 403.

    Dibaca dari basis data, bukan dari klaim token: token lama di perangkat
    lain masih memuat klaim persetujuan setelah ditarik (Pasal 40 UU PDP).
    Mengembalikan apakah jawaban boleh dikirim ke penyedia di luar negeri.
    """
    consent = current_consent(student_id)
    if consent is None:
        raise PermissionDenied(message)
    return ITEM_EXTERNAL_AI in consent.items


def reject_if_past_deadline(assignment: Assignment) -> None:
    if assignment.deadline and timezone.now() > assignment.deadline:
        raise ValidationError("Tenggat tugas sudah berakhir. Pengumpulan ditutup.")
    reject_if_archived(assignment.class_ref)


ARCHIVED_MESSAGE = (
    "Dosen pengampu telah menghapus akunnya, jadi kelas ini menjadi arsip "
    "dan tidak menerima jawaban baru."
)


def reject_if_archived(klass) -> None:
    """Kelas tanpa dosen tidak punya penilai; jawaban baru tidak akan pernah ditinjau."""
    if klass.is_archived:
        raise ValidationError(ARCHIVED_MESSAGE)


def new_words(before: str, after: str) -> int:
    """Banyak kata di `after` yang tidak ada (secara multiset) di `before`."""
    return sum((Counter(after.lower().split()) - Counter(before.lower().split())).values())


def _uploaded_id(assignment: Assignment, validated: dict):
    """document_id kiriman klien, diabaikan bila tugas ini wajib diketik."""
    return validated.get("document_id") if assignment.allow_file_upload else None


def _answer_text(student_id: UUID, document_id: UUID | None, typed: str) -> str:
    """Teks yang dianalisis: ketikan mahasiswa (nama, NIM) ditambah isi dokumen terlampir."""
    text = typed
    if document_id is not None and (document_text := read_text(student_id, document_id)):
        text = combine_with_document(typed, document_text)
    if len(text) > MAX_ANSWER_CHARS:
        raise ValidationError({"text_answer": "Jawaban terlalu panjang."})
    if len(text.split()) < MIN_ANSWER_WORDS:
        raise ValidationError(
            {"text_answer": f"Tulis minimal {MIN_ANSWER_WORDS} kata sebelum mengumpulkan."}
        )
    return text


def submit_answer(
    assignment: Assignment, student: Profile, validated: dict
) -> tuple[Submission, bool]:
    """Upsert jawaban mahasiswa. Mengembalikan (submission, is_revision).

    Tenggat dan persetujuan sudah diperiksa view sebelum isian divalidasi.
    Analisis tidak dijalankan di sini: job masuk antrean (dispatch).
    """
    existing = Submission.objects.filter(
        assignment=assignment, student_profile=student
    ).first()
    if existing is None:
        submission, job = _create(assignment, student, validated)
        revised = False
    else:
        if existing.status == SubmissionStatus.REVIEWED:
            raise ValidationError(ALREADY_GRADED)
        submission, job = _revise(existing, assignment, validated)
        revised = True
    # Setelah transaksi selesai: mode inline menjalankan job di sini, worker
    # produksi mengambilnya sendiri.
    analysis_jobs.dispatch(job)
    submission.refresh_from_db(fields=["analysis_state"])
    return submission, revised


def _create(
    assignment: Assignment, student: Profile, validated: dict
) -> tuple[Submission, AnalysisJob]:
    submitted_at = timezone.now()
    # Jejak pengerjaan berasal dari draf yang dicatat server. started_at dan
    # progress kiriman klien (bundel lama) diterima tetapi diabaikan: klien
    # tidak boleh menentukan bukti yang dipakai untuk menilainya sendiri.
    draft = get_draft(assignment, student)
    if validated.get("document_id") is None and draft is not None and draft.document_id:
        validated = {**validated, "document_id": draft.document_id}
    document_id = _uploaded_id(assignment, validated)
    text_answer = _answer_text(student.id, document_id, validated["text_answer"])
    started_at, duration_seconds, progress = trail_from(
        draft, submitted_at, count_words(text_answer)
    )
    source_document = verified_source(student.id, document_id, text_answer)
    try:
        with transaction.atomic():
            submission = Submission.objects.create(
                assignment=assignment,
                student_profile=student,
                text_answer=text_answer,
                rich_answer=validated.get("rich_answer"),
                source_document=source_document,
                started_at=started_at,
                submitted_at=submitted_at,
                duration_seconds=duration_seconds,
                revision_count=0,
                status=SubmissionStatus.SUBMITTED,
                analysis_state=AnalysisState.PENDING,
            )
            events = [
                ReasoningEvent(submission=submission, event_type=EventType.STARTED, occurred_at=started_at),
                ReasoningEvent(submission=submission, event_type=EventType.SUBMITTED, occurred_at=submitted_at),
            ] + [
                ReasoningEvent(
                    submission=submission,
                    event_type=EventType.PROGRESS,
                    payload={"word_count": sample.word_count},
                    occurred_at=started_at + timedelta(seconds=sample.offset_seconds),
                )
                for sample in progress
            ]
            ReasoningEvent.objects.bulk_create(events)
            job = analysis_jobs.enqueue(submission, AnalysisTrigger.SUBMIT)
            if draft is not None:
                draft.delete()
    except IntegrityError as exc:
        # Dua permintaan pertama tiba bersamaan (klik ganda): constraint
        # submission_unique_per_student menolak yang kedua.
        raise ValidationError(
            "Jawaban untuk tugas ini sedang diproses. Muat ulang halaman."
        ) from exc
    return submission, job


def _revise(
    submission: Submission, assignment: Assignment, validated: dict
) -> tuple[Submission, AnalysisJob]:
    # Klien selalu mengirim ulang dokumen yang masih terlampir; tanpa itu dokumen dianggap
    # dilepas. Teks yang ditulis ulang total kembali dinilai lewat jejak prosesnya.
    document_id = _uploaded_id(assignment, validated)
    text_answer = _answer_text(submission.student_profile_id, document_id, validated["text_answer"])
    source_document = verified_source(submission.student_profile_id, document_id, text_answer)
    with transaction.atomic():
        # Kunci baris dan baca ulang: selama request ini berjalan, dosen bisa
        # saja sudah menilai, atau revisi lain sudah tersimpan lebih dulu.
        locked = Submission.objects.select_for_update().get(pk=submission.pk)
        if locked.status == SubmissionStatus.REVIEWED:
            raise ValidationError(ALREADY_GRADED)
        revised_at = timezone.now()
        # Kata yang tidak ada di teks sebelumnya. Tanpa ini, jawaban yang diketik
        # wajar lalu diganti seluruhnya lewat "Simpan Revisi" tetap tampak wajar.
        inserted_now = new_words(locked.text_answer, text_answer)
        locked.text_answer = text_answer
        locked.rich_answer = validated.get("rich_answer")
        locked.source_document = source_document
        locked.revision_count += 1
        locked.submitted_at = revised_at
        locked.status = SubmissionStatus.SUBMITTED
        locked.save(
            update_fields=[
                "text_answer",
                "rich_answer",
                "source_document",
                "revision_count",
                "submitted_at",
                "status",
            ]
        )
        ReasoningEvent.objects.create(
            submission=locked,
            event_type=EventType.REVISION,
            payload={"revision_count": locked.revision_count, "inserted_words": inserted_now},
            occurred_at=revised_at,
        )
        job = analysis_jobs.enqueue(locked, AnalysisTrigger.REVISE)
    return locked, job


def request_reanalysis(submission: Submission, *, requested_by) -> AnalysisJob:
    """Antrekan analisis ulang atas permintaan dosen, memakai jejak proses tersimpan."""
    require_student_consent(
        submission.student_profile_id,
        "Mahasiswa ini belum menyetujui Kebijakan Privasi versi terbaru atau "
        "telah menarik persetujuannya, jadi analisis ulang tidak dijalankan. "
        "Hasil analisis yang sudah ada tetap tersimpan.",
    )
    with transaction.atomic():
        job = analysis_jobs.enqueue(
            submission, AnalysisTrigger.REANALYZE, requested_by=requested_by
        )
    analysis_jobs.dispatch(job)
    return job
