"""Agenda mahasiswa: tenggat tugas dan sesi diskusi jawaban, terurut waktu.

Tidak ada tabel jadwal tersendiri. Kedua jenis agenda sudah tersimpan sebagai
tenggat tugas dan jadwal verifikasi verbal, jadi agenda dirakit dari sana dan
tidak mungkin berbeda dari yang dilihat dosen.

Sesi verifikasi tampil di sini sebagai "sesi diskusi jawaban", tanpa hasil
dan catatannya. Mahasiswa perlu tahu kapan harus hadir; kesimpulan sesi tetap
catatan dosen.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from django.utils import timezone

from .models import (
    Assignment,
    Submission,
    SubmissionStatus,
    VerbalVerification,
    VerificationStatus,
)

# Sejauh ini ke depan agenda dibaca. Tenggat yang lebih jauh belum menuntut
# tindakan apa pun.
HORIZON = timedelta(days=60)
# Sesi yang baru saja lewat tetap tampil sebentar, karena dosen biasanya baru
# menandainya selesai setelah percakapan berakhir.
SESSION_GRACE = timedelta(hours=3)


def _submission_state(submission: Submission | None) -> str:
    if submission is None:
        return "not_submitted"
    if submission.status == SubmissionStatus.REVIEWED:
        return "graded"
    return "submitted"


def _deadlines(student_id: UUID, start: datetime, end: datetime) -> list[dict]:
    assignments = list(
        Assignment.objects.filter(
            class_ref__memberships__student_profile_id=student_id,
            deadline__gte=start,
            deadline__lt=end,
        ).select_related("class_ref")
    )
    latest: dict = {}
    for submission in Submission.objects.filter(
        student_profile_id=student_id,
        assignment_id__in=[assignment.id for assignment in assignments],
    ).order_by("assignment_id", "-created_at").only("id", "assignment_id", "status"):
        latest.setdefault(submission.assignment_id, submission)

    return [
        {
            "id": f"deadline:{assignment.id}",
            "kind": "deadline",
            "at": assignment.deadline,
            "title": assignment.title,
            "class_id": str(assignment.class_ref_id),
            "class_name": assignment.class_ref.name,
            "status": _submission_state(latest.get(assignment.id)),
            "link": f"/student/submit/{assignment.id}",
        }
        for assignment in assignments
    ]


def _sessions(
    student_id: UUID, start: datetime, end: datetime, statuses: list[str]
) -> list[dict]:
    sessions = VerbalVerification.objects.filter(
        submission__student_profile_id=student_id,
        status__in=statuses,
        scheduled_at__gte=start,
        scheduled_at__lt=end,
    ).select_related("submission__assignment__class_ref")
    items = []
    for session in sessions:
        assignment = session.submission.assignment
        items.append(
            {
                "id": f"session:{session.id}",
                "kind": "session",
                "at": session.scheduled_at,
                "title": f"Sesi diskusi jawaban: {assignment.title}",
                "class_id": str(assignment.class_ref_id),
                "class_name": assignment.class_ref.name,
                # Hanya "sudah berlangsung". Kesimpulannya tidak ikut.
                "status": "done"
                if session.status == VerificationStatus.COMPLETED
                else "scheduled",
                "link": f"/student/submit/{assignment.id}",
            }
        )
    return items


def build_student_schedule(student_id: UUID, now: datetime | None = None) -> list[dict]:
    """Agenda yang akan datang, untuk kartu "Agenda terdekat" di beranda."""
    now = now or timezone.now()
    items = _deadlines(student_id, now, now + HORIZON) + _sessions(
        student_id,
        now - SESSION_GRACE,
        now + HORIZON,
        [VerificationStatus.SCHEDULED],
    )
    items.sort(key=lambda item: item["at"])
    return items


def build_student_calendar(student_id: UUID, start: datetime, end: datetime) -> list[dict]:
    """Seluruh agenda dalam satu rentang kalender, termasuk yang sudah lewat.

    Kalender juga dipakai untuk melihat ke belakang, jadi tenggat yang lewat
    ikut tampil beserta statusnya. Sesi yang sudah berlangsung tampil sebagai
    riwayat; sesi yang dibatalkan tidak, karena memang tidak pernah terjadi.
    """
    items = _deadlines(student_id, start, end) + _sessions(
        student_id,
        start,
        end,
        [VerificationStatus.SCHEDULED, VerificationStatus.COMPLETED],
    )
    items.sort(key=lambda item: item["at"])
    return items
