"""Alur pengumpulan jawaban: submit pertama, revisi, dan analisis ulang.

Ketiganya merakit argumen analisis lewat satu fungsi (_analyse_for) supaya
tidak ada jalur yang diam-diam memakai konteks proses yang berbeda.

Analisis (bisa ~20 detik: Winston + Groq) sengaja dijalankan SEBELUM
transaksi dibuka, supaya tidak ada baris yang terkunci selama menunggu API.
"""
from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.academics.models import (
    Assignment,
    EventType,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
)
from apps.academics.selectors import stored_progress
from apps.academics.services.documents import verified_source
from apps.accounts.models import Profile
from apps.accounts.privacy import ITEM_EXTERNAL_AI, current_consent
from apps.analysis.engines.process_signals import ProcessContext, ProgressSample
from apps.analysis.models import AnalysisResult
from apps.analysis.pipeline import run_analysis

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


def _analyse_for(
    text_answer: str,
    assignment: Assignment,
    *,
    duration_seconds: int | None,
    revision_count: int,
    allow_external: bool,
    progress: tuple = (),
    imported: bool = False,
) -> dict:
    """Satu-satunya jalan masuk ke run_analysis dari alur submission.

    allow_external sengaja tanpa nilai bawaan: tiap pemanggil wajib
    memutuskannya dari persetujuan mahasiswa. Jam dinding tidak ikut dikirim;
    backend UTC, jam hanya diformat di frontend.

    Jawaban yang diimpor dari dokumen tiba sekaligus, sehingga forensik proses
    akan membacanya sebagai tempelan. Tanpa jejak mengetik, sinyal itu dilewati
    (process=None) dan skor bertumpu pada teks; dosen melihat lencana "diimpor".
    """
    process = None if imported else ProcessContext(
        duration_seconds=duration_seconds,
        revision_count=revision_count,
        word_count=len(text_answer.split()),
        char_count=len(text_answer),
        progress=progress,
    )
    return run_analysis(
        text_answer,
        assignment.class_ref.education_level,
        assignment.expected_bloom_level,
        process,
        allow_external=allow_external,
    )


def _uploaded_id(assignment: Assignment, validated: dict):
    """document_id kiriman klien, diabaikan bila tugas ini wajib diketik."""
    return validated.get("document_id") if assignment.allow_file_upload else None


def submit_answer(
    assignment: Assignment, student: Profile, validated: dict, *, allow_external: bool
) -> tuple[Submission, bool]:
    """Upsert jawaban mahasiswa. Mengembalikan (submission, is_revision).

    Tenggat dan persetujuan sudah diperiksa view sebelum isian divalidasi.
    """
    existing = Submission.objects.filter(
        assignment=assignment, student_profile=student
    ).first()
    if existing is None:
        return _create(assignment, student, validated, allow_external), False
    if existing.status == SubmissionStatus.REVIEWED:
        raise ValidationError(ALREADY_GRADED)
    return _revise(existing, assignment, validated, allow_external), True


def _create(
    assignment: Assignment, student: Profile, validated: dict, allow_external: bool
) -> Submission:
    text_answer = validated["text_answer"]
    submitted_at = timezone.now()
    started_at = min(validated.get("started_at") or submitted_at, submitted_at)
    duration_seconds = int((submitted_at - started_at).total_seconds())

    # Cuplikan di luar jendela mulai-kumpul pasti bukan hasil mengetik nyata;
    # klien yang mengarang jejak tidak dipercaya begitu saja.
    samples = sorted(
        (s for s in validated.get("progress") or [] if started_at <= s["at"] <= submitted_at),
        key=lambda s: s["at"],
    )
    progress = tuple(
        ProgressSample(
            offset_seconds=max(0, int((s["at"] - started_at).total_seconds())),
            word_count=s["word_count"],
        )
        for s in samples
    )
    source_document = verified_source(
        student.id, _uploaded_id(assignment, validated), text_answer
    )
    analysis = _analyse_for(
        text_answer,
        assignment,
        duration_seconds=duration_seconds,
        revision_count=0,
        allow_external=allow_external,
        progress=progress,
        imported=source_document is not None,
    )
    try:
        with transaction.atomic():
            submission = Submission.objects.create(
                assignment=assignment,
                student_profile=student,
                text_answer=text_answer,
                source_document=source_document,
                started_at=started_at,
                submitted_at=submitted_at,
                duration_seconds=duration_seconds,
                revision_count=0,
                status=SubmissionStatus.SUBMITTED,
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
            AnalysisResult.objects.create(submission=submission, **analysis)
    except IntegrityError as exc:
        # Dua permintaan pertama tiba bersamaan (klik ganda): constraint
        # submission_unique_per_student menolak yang kedua.
        raise ValidationError(
            "Jawaban untuk tugas ini sedang diproses. Muat ulang halaman."
        ) from exc
    return submission


def _revise(
    submission: Submission, assignment: Assignment, validated: dict, allow_external: bool
) -> Submission:
    text_answer = validated["text_answer"]
    # Dokumen baru bila diunggah ulang; kalau tidak, dokumen lama tetap berlaku
    # selama teks revisi masih berasal darinya. Teks yang ditulis ulang total
    # kembali dinilai lewat jejak prosesnya.
    source_document = verified_source(
        submission.student_profile_id,
        _uploaded_id(assignment, validated) or submission.source_document,
        text_answer,
    )
    # revision_count di sini masih nilai lama; revisi yang sedang berjalan
    # ikut dihitung supaya bukti proses sama dengan angka yang nanti tersimpan.
    analysis = _analyse_for(
        text_answer,
        assignment,
        duration_seconds=submission.duration_seconds,
        revision_count=submission.revision_count + 1,
        allow_external=allow_external,
        progress=stored_progress(submission),
        imported=source_document is not None,
    )
    with transaction.atomic():
        # Kunci baris dan baca ulang: selama analisis berjalan, dosen bisa saja
        # sudah menilai, atau revisi lain sudah tersimpan lebih dulu.
        locked = Submission.objects.select_for_update().get(pk=submission.pk)
        if locked.status == SubmissionStatus.REVIEWED:
            raise ValidationError(ALREADY_GRADED)
        revised_at = timezone.now()
        locked.text_answer = text_answer
        locked.source_document = source_document
        locked.revision_count += 1
        locked.submitted_at = revised_at
        locked.status = SubmissionStatus.SUBMITTED
        locked.save(
            update_fields=["text_answer", "source_document", "revision_count", "submitted_at", "status"]
        )
        ReasoningEvent.objects.create(
            submission=locked,
            event_type=EventType.REVISION,
            payload={"revision_count": locked.revision_count},
            occurred_at=revised_at,
        )
        AnalysisResult.objects.update_or_create(submission=locked, defaults=analysis)
    return locked


def reanalyze(submission: Submission) -> AnalysisResult:
    """Analisis ulang atas permintaan dosen, memakai jejak proses tersimpan."""
    allow_external = require_student_consent(
        submission.student_profile_id,
        "Mahasiswa ini belum menyetujui Kebijakan Privasi versi terbaru atau "
        "telah menarik persetujuannya, jadi analisis ulang tidak dijalankan. "
        "Hasil analisis yang sudah ada tetap tersimpan.",
    )
    analysis = _analyse_for(
        submission.text_answer,
        submission.assignment,
        duration_seconds=submission.duration_seconds,
        revision_count=submission.revision_count,
        allow_external=allow_external,
        progress=stored_progress(submission),
        imported=submission.is_imported,
    )
    result, _ = AnalysisResult.objects.update_or_create(
        submission=submission, defaults=analysis
    )
    return result
