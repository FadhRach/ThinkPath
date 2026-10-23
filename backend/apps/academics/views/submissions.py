"""Submission: kumpul/revisi (mahasiswa), antrean, detail, nilai, dan analisis ulang."""
from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import (
    Submission,
    SubmissionStatus,
)
from apps.academics.selectors import (
    require_member_assignment,
    require_owned_assignment,
    require_owned_submission,
)
from apps.academics.serializers import (
    SubmissionCreateSerializer,
    SubmissionDetailSerializer,
    SubmissionGradeSerializer,
    SubmissionListSerializer,
    SubmissionQueueSerializer,
)
from apps.academics.services.submissions import (
    reject_if_past_deadline,
    request_reanalysis,
    require_student_consent,
    submit_answer,
)
from apps.accounts.permissions import IsStudent, IsTeacher
from apps.accounts.services import get_request_profile
from apps.notifications import events as notify_events
from apps.notifications.services import safe
from common.http import request_user_id
from common.throttling import PerUserScopedThrottle

VISIBLE_STATUSES = [SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWED]


class SubmissionListView(APIView):
    """GET daftar submission satu tugas (dosen). POST kumpul/revisi (mahasiswa)."""

    throttle_scope = "submission_submit"

    def get_throttles(self):
        # Hanya POST yang memicu analisis berbayar; dosen membuka daftar bebas.
        return [PerUserScopedThrottle()] if self.request.method == "POST" else []

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [IsTeacher()]

    def get(self, request, assignment_id: str):
        assignment = require_owned_assignment(request, assignment_id)
        submissions = (
            Submission.objects.filter(assignment=assignment)
            .select_related("student_profile", "analysis")
            .order_by("-submitted_at")
        )
        return Response(SubmissionListSerializer(submissions, many=True).data)

    def post(self, request, assignment_id: str):
        assignment = require_member_assignment(request, assignment_id)
        reject_if_past_deadline(assignment)
        student = get_request_profile(request)
        require_student_consent(
            student.id,
            "Setujui Kebijakan Privasi versi terbaru sebelum mengumpulkan jawaban. "
            "Muat ulang halaman untuk menyetujuinya.",
        )
        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission, revised = submit_answer(assignment, student, serializer.validated_data)
        safe(lambda: notify_events.submission_received(submission, revised=revised))
        detail = "Revisi jawaban berhasil disimpan." if revised else "Jawaban berhasil dikumpulkan."
        return Response(
            {"id": str(submission.id), "detail": detail}, status=status.HTTP_201_CREATED
        )


QUEUE_DEFAULT_LIMIT = 200
QUEUE_MAX_LIMIT = 500


def _page_size(raw: str | None) -> int:
    if raw is None or not raw.isdigit() or int(raw) < 1:
        return QUEUE_DEFAULT_LIMIT
    return min(int(raw), QUEUE_MAX_LIMIT)


class TeacherSubmissionQueueView(APIView):
    """GET pengumpulan lintas kelas milik dosen; filter ?status=all|submitted|reviewed."""

    permission_classes = [IsTeacher]

    def get(self, request):
        selected = request.query_params.get("status", "all")
        if selected not in ["all", *VISIBLE_STATUSES]:
            raise ValidationError({"status": "Status tidak dikenal."})
        rows = Submission.objects.filter(
            assignment__class_ref__owner_id=request_user_id(request),
            status__in=VISIBLE_STATUSES if selected == "all" else [selected],
        )
        rows = rows.select_related(
            "student_profile", "assignment__class_ref", "analysis"
        ).order_by("-submitted_at", "-created_at")
        # Dibatasi: tanpa batas, dosen dengan ribuan pengumpulan menerima dan
        # merender semuanya. Total sebenarnya ada di header untuk penanda "terpotong".
        total = rows.count()
        limit = _page_size(request.query_params.get("limit"))
        raw_offset = request.query_params.get("offset", "0")
        offset = int(raw_offset) if raw_offset.isdigit() else 0
        response = Response(SubmissionQueueSerializer(rows[offset : offset + limit], many=True).data)
        response["X-Total-Count"] = str(total)
        return response


class SubmissionDetailView(APIView):
    """GET detail submission; PATCH nilai + umpan balik dosen."""

    permission_classes = [IsTeacher]

    def get(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        return Response(SubmissionDetailSerializer(submission).data)

    def patch(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        serializer = SubmissionGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = (submission.status, submission.grade, submission.teacher_feedback)
        submission.grade = serializer.validated_data["grade"]
        submission.teacher_feedback = serializer.validated_data["teacher_feedback"]
        submission.status = SubmissionStatus.REVIEWED
        submission.save(update_fields=["grade", "teacher_feedback", "status"])
        # Menyimpan ulang nilai yang sama tidak perlu mengabari mahasiswa lagi.
        if before != (submission.status, submission.grade, submission.teacher_feedback):
            safe(lambda: notify_events.submission_graded(submission))
        return Response(SubmissionDetailSerializer(submission).data)


class SubmissionReanalyzeView(APIView):
    """POST antrekan analisis ulang satu submission (dosen pemilik).

    Membalas 202: hasilnya dikerjakan worker. Layar dosen memuat ulang sampai
    `analysis_state` kembali "done"."""

    permission_classes = [IsTeacher]
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "submission_reanalyze"

    def post(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        request_reanalysis(submission, requested_by=get_request_profile(request))
        submission.refresh_from_db(fields=["analysis_state"])
        return Response(
            {"analysis_state": submission.analysis_state}, status=status.HTTP_202_ACCEPTED
        )
