"""Query baca untuk app academics.

Kepemilikan objek diperiksa di sini dengan satu query `select_related` lalu
dicek di memori, supaya permission dan view tidak mem-fetch objek yang sama
dua kali. Objek milik orang lain dibalas 404, bukan 403, agar keberadaannya
tidak bocor.
"""
from __future__ import annotations

from uuid import UUID

from django.db.models import Count, Prefetch, Q
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.academics.models import (
    Assignment,
    Class,
    ClassMembership,
    EventType,
    Material,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
)
from apps.analysis.choices import AiBand
from apps.analysis.engines.process_signals import ProgressSample
from common.http import parse_uuid_or_404, request_user_id


def require_owned_class(request, class_id: str) -> Class:
    """Kelas milik dosen pemanggil."""
    target = Class.objects.filter(pk=parse_uuid_or_404(class_id)).first()
    if target is None or target.owner_id != request_user_id(request):
        raise NotFound()
    return target


def require_member_class(request, class_id: str) -> Class:
    """Kelas yang diikuti mahasiswa pemanggil."""
    target = Class.objects.filter(
        pk=parse_uuid_or_404(class_id),
        memberships__student_profile_id=request_user_id(request),
    ).first()
    if target is None:
        raise NotFound()
    return target


def require_owned_assignment(request, assignment_id: str) -> Assignment:
    """Tugas di kelas milik dosen pemanggil (class_ref ikut di-load)."""
    assignment = (
        Assignment.objects.select_related("class_ref")
        .filter(pk=parse_uuid_or_404(assignment_id))
        .first()
    )
    if assignment is None or assignment.class_ref.owner_id != request_user_id(request):
        raise NotFound()
    return assignment


def require_member_assignment(request, assignment_id: str) -> Assignment:
    """Tugas di kelas yang diikuti mahasiswa pemanggil."""
    assignment = (
        Assignment.objects.select_related("class_ref")
        .filter(pk=parse_uuid_or_404(assignment_id))
        .first()
    )
    if assignment is None:
        raise NotFound()
    is_member = ClassMembership.objects.filter(
        class_ref_id=assignment.class_ref_id,
        student_profile_id=request_user_id(request),
    ).exists()
    if not is_member:
        raise PermissionDenied("Kamu bukan anggota kelas ini.")
    return assignment


def require_owned_submission(request, submission_id: str) -> Submission:
    """Submission di kelas milik dosen pemanggil, lengkap untuk layar detail."""
    submission = (
        Submission.objects.select_related(
            "assignment__class_ref", "student_profile", "analysis", "verification"
        )
        # Sudah terurut di sini; serializer cukup memakai .all(). Memanggil
        # .order_by() lagi di serializer membuang hasil prefetch.
        .prefetch_related(
            Prefetch(
                "reasoning_events",
                queryset=ReasoningEvent.objects.order_by("occurred_at"),
            )
        )
        .filter(pk=parse_uuid_or_404(submission_id))
        .first()
    )
    if submission is None or (
        submission.assignment.class_ref.owner_id != request_user_id(request)
    ):
        raise NotFound()
    return submission


def require_owned_material(request, material_id: str) -> Material:
    material = (
        Material.objects.select_related("class_ref")
        .filter(pk=parse_uuid_or_404(material_id))
        .first()
    )
    if material is None or material.class_ref.owner_id != request_user_id(request):
        raise NotFound()
    return material


def assignment_annotations() -> dict:
    """Hitungan per tugas. Dipakai semua daftar tugas agar angkanya selalu sama."""
    return {
        "submission_count": Count("submissions", distinct=True),
        "high_band_count": Count(
            "submissions",
            filter=Q(submissions__analysis__ai_band=AiBand.HIGH),
            distinct=True,
        ),
        "needs_review_count": Count(
            "submissions",
            filter=Q(submissions__status=SubmissionStatus.SUBMITTED),
            distinct=True,
        ),
    }


def assignment_summary(assignment_id: UUID) -> Assignment:
    return (
        Assignment.objects.filter(pk=assignment_id)
        .select_related("class_ref")
        .annotate(**assignment_annotations())
        .get()
    )


def student_submissions_by_assignment(
    student_id: UUID, assignment_ids: list, *, include_text: bool = True
) -> dict:
    """Map assignment_id -> submission mahasiswa (maksimal satu per tugas).

    include_text=False untuk listing: esai tidak tampil di daftar, jadi tidak
    perlu ikut terangkut dari database.
    """
    submissions = Submission.objects.filter(
        student_profile_id=student_id, assignment_id__in=assignment_ids
    )
    if not include_text:
        submissions = submissions.defer("text_answer")
    return {submission.assignment_id: submission for submission in submissions}


def stored_progress(submission: Submission) -> tuple[ProgressSample, ...]:
    """Jejak pertumbuhan kata yang tersimpan, untuk revisi dan analisis ulang.

    Tanpa ini, siasat tempel-lalu-tunggu yang tertangkap saat submit pertama
    kembali terbaca wajar begitu jawaban direvisi atau dianalisis ulang.
    """
    started = submission.started_at
    samples: list[ProgressSample] = []
    for event in submission.reasoning_events.all():
        if event.event_type != EventType.PROGRESS:
            continue
        words = (event.payload or {}).get("word_count")
        if isinstance(words, int):
            samples.append(
                ProgressSample(
                    offset_seconds=max(
                        0, int((event.occurred_at - started).total_seconds())
                    ),
                    word_count=words,
                )
            )
    return tuple(sorted(samples, key=lambda sample: sample.offset_seconds))
