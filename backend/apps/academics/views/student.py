"""Layar mahasiswa: kelas yang diikuti, detail tugas, materi, dan jadwal.

Skor AI tidak pernah dikirim ke mahasiswa (lihat StudentSubmissionStatusSerializer).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Assignment, ClassMembership, Material
from apps.academics.schedule import build_student_calendar, build_student_schedule
from apps.academics.selectors import (
    require_member_assignment,
    student_submissions_by_assignment,
)
from apps.academics.serializers import (
    ClassPublicSerializer,
    MaterialSerializer,
    StudentAssignmentSerializer,
    StudentSubmissionStatusListSerializer,
    StudentSubmissionStatusSerializer,
)
from apps.academics.services.drafts import get_draft
from apps.accounts.permissions import IsStudent
from apps.accounts.services import get_request_profile
from common.http import request_user_id

# Rentang kalender terlebar per permintaan: tampilan bulan memuat paling
# banyak enam pekan, jadi satu permintaan tidak bisa menyapu setahun penuh.
SCHEDULE_MAX_RANGE = timedelta(days=62)


class StudentClassListView(APIView):
    """GET kelas yang diikuti mahasiswa beserta status tiap tugas."""

    permission_classes = [IsStudent]

    def get(self, request):
        student_id = request_user_id(request)
        memberships = (
            ClassMembership.objects.filter(student_profile_id=student_id)
            .select_related("class_ref__owner")
            .order_by("-joined_at")
        )
        assignments = (
            Assignment.objects.filter(
                class_ref_id__in=[membership.class_ref_id for membership in memberships]
            )
            .select_related("class_ref")
            .order_by("-created_at")
        )
        submissions = student_submissions_by_assignment(
            student_id, [assignment.id for assignment in assignments], include_text=False
        )

        assignments_by_class: dict = {}
        for assignment in assignments:
            submission = submissions.get(assignment.id)
            row = StudentAssignmentSerializer(assignment).data
            row["submission"] = (
                StudentSubmissionStatusListSerializer(submission).data if submission else None
            )
            assignments_by_class.setdefault(assignment.class_ref_id, []).append(row)

        return Response(
            [
                {
                    "id": str(membership.class_ref.id),
                    "name": membership.class_ref.name,
                    "subject": membership.class_ref.subject,
                    "education_level": membership.class_ref.education_level,
                    "program_studi": membership.class_ref.program_studi,
                    "semester": membership.class_ref.semester,
                    "teacher_name": (
                        membership.class_ref.owner.label if membership.class_ref.owner else None
                    ),
                    "is_archived": membership.class_ref.is_archived,
                    "owner_left_at": membership.class_ref.owner_left_at,
                    "joined_at": membership.joined_at,
                    "assignments": assignments_by_class.get(membership.class_ref_id, []),
                }
                for membership in memberships
            ]
        )


class StudentAssignmentDetailView(APIView):
    """GET detail satu tugas untuk mahasiswa anggota kelasnya."""

    permission_classes = [IsStudent]

    def get(self, request, assignment_id: str):
        assignment = require_member_assignment(request, assignment_id)
        submission = student_submissions_by_assignment(
            request_user_id(request), [assignment.id]
        ).get(assignment.id)
        draft = None if submission else get_draft(assignment, get_request_profile(request))
        return Response(
            {
                "class": ClassPublicSerializer(assignment.class_ref).data,
                "assignment": StudentAssignmentSerializer(assignment).data,
                "submission": (
                    StudentSubmissionStatusSerializer(submission).data if submission else None
                ),
                # Draf tersimpan agar halaman yang ditutup tidak menghilangkan tulisan.
                "draft": (
                    {
                        "text_answer": draft.text_answer,
                        "document_id": draft.document_id,
                        "saved_at": draft.last_saved_at,
                    }
                    if draft
                    else None
                ),
            }
        )


class StudentMaterialListView(APIView):
    """GET materi dari seluruh kelas yang diikuti, terbaru di atas."""

    permission_classes = [IsStudent]

    def get(self, request):
        materials = (
            Material.objects.filter(
                class_ref__memberships__student_profile_id=request_user_id(request)
            )
            .select_related("class_ref")
            .order_by("-created_at")
        )
        return Response(MaterialSerializer(materials, many=True).data)


def _parse_instant(raw: str | None) -> datetime | None:
    if not raw:
        return None
    # Tanda "+" pada zona waktu berubah menjadi spasi bila tidak di-encode.
    value = parse_datetime(raw.strip().replace(" ", "+"))
    if value is None or timezone.is_naive(value):
        return None
    return value


class StudentScheduleView(APIView):
    """GET agenda mahasiswa: tenggat tugas dan batas waktu Cek Paham.

    Tanpa parameter: agenda mendatang (kartu beranda). Dengan start & end
    (ISO 8601 berzona): seluruh agenda di rentang itu (kalender). Batas hari
    dihitung frontend pada zona tampilan.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        student_id = request_user_id(request)
        raw_start = request.query_params.get("start")
        raw_end = request.query_params.get("end")
        if raw_start is None and raw_end is None:
            return Response(build_student_schedule(student_id))

        start, end = _parse_instant(raw_start), _parse_instant(raw_end)
        if start is None or end is None:
            raise ValidationError("start dan end wajib berupa waktu ISO 8601 lengkap dengan zona.")
        # Dibandingkan lewat selisih, bukan start + 62 hari: penjumlahan itu
        # meluap untuk tanggal dekat tahun 9999 dan berakhir sebagai galat 500.
        if not (start < end and end - start <= SCHEDULE_MAX_RANGE):
            raise ValidationError("Rentang jadwal harus maju dan paling panjang 62 hari.")
        return Response(build_student_calendar(student_id, start, end))
