"""Agenda mahasiswa: tenggat tugas dan batas waktu Cek Paham, terurut waktu.

Tidak ada tabel jadwal tersendiri. Kedua jenis agenda sudah tersimpan sebagai
tenggat tugas dan jendela waktu Cek Paham, jadi agenda dirakit dari sana dan
tidak mungkin berbeda dari yang dilihat dosen.

Cek Paham tampil dengan batas akhir jendelanya dan status "sudah dikerjakan"
atau belum. Skor, band, dan soalnya tidak ikut: itu bukan urusan mahasiswa.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from django.utils import timezone

from apps.academics.models import Assignment, Submission, SubmissionStatus
from apps.cekpaham.models import CekPaham, RequestStatus
from apps.cekpaham.selectors import live_attempt

# Sejauh ini ke depan agenda dibaca. Tenggat yang lebih jauh belum menuntut
# tindakan apa pun.
HORIZON = timedelta(days=60)


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


def _cekpaham(student_id: UUID, start: datetime, end: datetime, *, include_done: bool) -> list[dict]:
    """Cek Paham aktif yang jendelanya berakhir dalam rentang.

    Dianggap dikerjakan bila sudah ada sesi yang berlaku (selesai, diproses,
    atau terputus): mahasiswa tidak punya tindakan lagi sampai dosen memberi
    kesempatan ulang, dan saat itu sesi lamanya di-void.
    """
    requests = (
        CekPaham.objects.filter(
            submission__student_profile_id=student_id,
            status=RequestStatus.ACTIVE,
            window_end__gte=start,
            window_end__lt=end,
        )
        .select_related("submission__assignment__class_ref")
        .prefetch_related("attempts")
    )
    items = []
    for cekpaham in requests:
        done = live_attempt(cekpaham) is not None
        if done and not include_done:
            continue
        assignment = cekpaham.submission.assignment
        items.append(
            {
                "id": f"cekpaham:{cekpaham.id}",
                "kind": "cekpaham",
                "at": cekpaham.window_end,
                "title": f"Cek Paham: {assignment.title}",
                "class_id": str(assignment.class_ref_id),
                "class_name": assignment.class_ref.name,
                "status": "done" if done else "scheduled",
                "link": f"/student/cekpaham/{cekpaham.id}",
            }
        )
    return items


def build_student_schedule(student_id: UUID, now: datetime | None = None) -> list[dict]:
    """Agenda yang akan datang, untuk kartu "Agenda terdekat" di beranda."""
    now = now or timezone.now()
    items = _deadlines(student_id, now, now + HORIZON) + _cekpaham(
        student_id, now, now + HORIZON, include_done=False
    )
    items.sort(key=lambda item: item["at"])
    return items


def build_student_calendar(student_id: UUID, start: datetime, end: datetime) -> list[dict]:
    """Seluruh agenda dalam satu rentang kalender, termasuk yang sudah lewat.

    Kalender juga dipakai untuk melihat ke belakang, jadi tenggat yang lewat
    ikut tampil beserta statusnya. Cek Paham yang sudah dikerjakan tampil
    sebagai riwayat; yang dibatalkan dosen tidak, karena tidak lagi berlaku.
    """
    items = _deadlines(student_id, start, end) + _cekpaham(
        student_id, start, end, include_done=True
    )
    items.sort(key=lambda item: item["at"])
    return items
