"""Endpoint Cek Paham. Tipis: HTTP saja, logika di services/ dan selectors.py.

Endpoint yang memanggil Groq (buat, mulai, caption, finalisasi, proses ulang)
membalas 503 bila kunci Groq tidak terpasang; membaca hasil tetap berfungsi.
"""
from __future__ import annotations

import json

from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.selectors import require_owned_submission
from apps.accounts.permissions import IsStudent, IsTeacher
from apps.accounts.services import get_request_profile
from apps.analysis.providers import groq
from apps.cekpaham.models import CekPaham
from apps.cekpaham.selectors import (
    require_attempt,
    require_own_cekpaham_student,
    require_owned_cekpaham,
    require_report_for_teacher,
    teacher_queue,
)
from apps.cekpaham.serializers import (
    CekPahamCreateSerializer,
    CekPahamDetailSerializer,
    CekPahamTeacherSerializer,
    ReportCreateSerializer,
    ReportResolveSerializer,
    STUDENT_STATE,
    StudentCekPahamSerializer,
)
from apps.cekpaham.services import attempts, audio, lifecycle
from apps.notifications import events as notify_events
from apps.notifications.services import safe
from common.http import request_user_id
from common.throttling import PerUserScopedThrottle

QUEUE_PREFETCH = "attempts__reports"


class ServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Cek Paham belum tersedia di server ini."
    default_code = "service_unavailable"


class GroqConfigured(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not groq.is_configured():
            raise ServiceUnavailable()
        return True


def _reload(cekpaham: CekPaham) -> CekPaham:
    """Muat ulang dengan relasi yang dibutuhkan serializer detail (tanpa query per baris)."""
    return (
        CekPaham.objects.select_related("submission__assignment__class_ref", "submission__student_profile")
        .prefetch_related(QUEUE_PREFETCH)
        .get(pk=cekpaham.pk)
    )


def _detail(cekpaham: CekPaham) -> dict:
    return CekPahamDetailSerializer(_reload(cekpaham)).data


def _student_detail(cekpaham: CekPaham) -> dict:
    return StudentCekPahamSerializer(_reload(cekpaham)).data


def _read_upload(upload, limit: int) -> bytes:
    if upload.size > limit:
        raise ValidationError({"audio": f"Audio maksimal {limit // (1024 * 1024) or 1} MB."})
    return upload.read()


# --- dosen -----------------------------------------------------------------

class SubmissionCekPahamView(APIView):
    """GET daftar Cek Paham atas satu jawaban; POST membuat yang baru."""

    def get_permissions(self):
        return [IsTeacher(), GroqConfigured()] if self.request.method == "POST" else [IsTeacher()]

    def get(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        items = (
            CekPaham.objects.filter(submission=submission)
            .select_related("submission__assignment__class_ref", "submission__student_profile")
            .prefetch_related(QUEUE_PREFETCH)
            .order_by("-created_at")
        )
        return Response(CekPahamTeacherSerializer(items, many=True).data)

    def post(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        serializer = CekPahamCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cekpaham = lifecycle.create_request(
            get_request_profile(request), submission, serializer.validated_data
        )
        safe(lambda: notify_events.cekpaham_created(cekpaham))
        return Response(_detail(cekpaham), status=status.HTTP_201_CREATED)


class CekPahamQueueView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request):
        flag = request.query_params.get("has_open_report")
        items = teacher_queue(
            request_user_id(request),
            status=request.query_params.get("status"),
            phase=request.query_params.get("phase"),
            has_open_report=None if flag is None else flag.lower() in ("1", "true"),
        ).prefetch_related(QUEUE_PREFETCH)
        return Response(CekPahamTeacherSerializer(items, many=True).data)


class CekPahamDetailView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request, cekpaham_id: str):
        return Response(_detail(require_owned_cekpaham(request, cekpaham_id)))


class CekPahamCancelView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, cekpaham_id: str):
        cekpaham = lifecycle.cancel_request(require_owned_cekpaham(request, cekpaham_id))
        return Response(_detail(cekpaham))


class CekPahamAudioView(APIView):
    """Audio jawaban untuk dosen pemilik kelas; tidak pernah lewat URL statis."""

    # Berkas besar melewati batas badan fungsi Vercel; lihat UploadTicketView.
    accepts_upload_ticket = True

    permission_classes = [IsTeacher]

    def get(self, request, cekpaham_id: str, number: int):
        attempt = require_attempt(require_owned_cekpaham(request, cekpaham_id), number)
        found = audio.open_audio(attempt)
        if found is None:
            raise NotFound("Audio tidak tersedia (belum terkirim atau sudah melewati masa simpan).")
        handle, content_type = found
        response = FileResponse(handle, content_type=content_type)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class CekPahamReprocessView(APIView):
    permission_classes = [IsTeacher, GroqConfigured]

    def post(self, request, cekpaham_id: str, number: int):
        cekpaham = require_owned_cekpaham(request, cekpaham_id)
        attempts.reprocess_attempt(require_attempt(cekpaham, number))
        return Response(_detail(cekpaham))


class CekPahamReportResolveView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, report_id: str):
        report = require_report_for_teacher(request, report_id)
        serializer = ReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        resolved = lifecycle.resolve_report(
            get_request_profile(request), report, data["resolution"], data["response_note"], data["extend_window_to"]
        )
        safe(lambda: notify_events.cekpaham_report_resolved(resolved))
        return Response(_detail(report.attempt.cekpaham))


# --- mahasiswa -------------------------------------------------------------

class StudentCekPahamDetailView(APIView):
    permission_classes = [IsStudent]

    def get(self, request, cekpaham_id: str):
        cekpaham = require_own_cekpaham_student(request, cekpaham_id)
        attempts.expire_stale(cekpaham)
        return Response(_student_detail(cekpaham))


class StudentCekPahamStartView(APIView):
    permission_classes = [IsStudent, GroqConfigured]

    def post(self, request, cekpaham_id: str):
        cekpaham = require_own_cekpaham_student(request, cekpaham_id)
        attempt = attempts.start_attempt(cekpaham, request_user_id(request))
        response = Response(
            {
                # Satu-satunya tempat soal keluar.
                "question_text": cekpaham.question_text,
                "number": attempt.number,
                "deadline_at": attempt.deadline_at,
                "server_now": timezone.now(),
                "answer_seconds": cekpaham.answer_seconds,
            },
            status=status.HTTP_201_CREATED,
        )
        response["Cache-Control"] = "no-store"
        return response


class StudentCekPahamLiveView(APIView):
    """Caption sementara dari satu potongan audio (multipart `audio`, `purpose`)."""

    permission_classes = [IsStudent, GroqConfigured]
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "cekpaham_live"

    def post(self, request, cekpaham_id: str):
        cekpaham = require_own_cekpaham_student(request, cekpaham_id)
        purpose = request.data.get("purpose", "answer")
        if purpose not in ("answer", "mic_test"):
            raise ValidationError({"purpose": "Harus 'answer' atau 'mic_test'."})
        upload = request.FILES.get("audio")
        if upload is None:
            raise ValidationError({"audio": "Potongan audio tidak ditemukan."})
        result = attempts.transcribe_live(
            cekpaham,
            request_user_id(request),
            _read_upload(upload, audio.MAX_LIVE_CHUNK_BYTES),
            upload.content_type,
            purpose,
        )
        response = Response(result)
        response["Cache-Control"] = "no-store"
        return response


class StudentCekPahamFinalizeView(APIView):
    """Audio utuh + konteks dari klien. Membalas status dan transkrip milik mahasiswa saja."""

    # Berkas besar melewati batas badan fungsi Vercel; lihat UploadTicketView.
    accepts_upload_ticket = True

    permission_classes = [IsStudent, GroqConfigured]
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "cekpaham_finalize"

    def post(self, request, cekpaham_id: str):
        cekpaham = require_own_cekpaham_student(request, cekpaham_id)
        upload = request.FILES.get("audio")
        # Multipart mengirim string JSON; badan JSON bisa langsung berupa objek.
        events = request.data.get("client_events")
        if not isinstance(events, dict):
            try:
                events = json.loads(events or "{}")
            except (TypeError, ValueError):
                events = {}
        attempt, fresh = attempts.finalize_attempt(
            cekpaham,
            request_user_id(request),
            data=_read_upload(upload, audio.MAX_AUDIO_BYTES) if upload else None,
            content_type=upload.content_type if upload else None,
            live_transcript=request.data.get("live_transcript", ""),
            client_events=events,
            interrupted=str(request.data.get("interrupted", "")).lower() in ("1", "true"),
        )
        if fresh:
            safe(lambda: notify_events.cekpaham_finished(attempt))
        return Response({"state": STUDENT_STATE[attempt.status], "transcript": attempt.final_transcript})


class StudentCekPahamReportView(APIView):
    permission_classes = [IsStudent]

    def post(self, request, cekpaham_id: str):
        cekpaham = require_own_cekpaham_student(request, cekpaham_id)
        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = lifecycle.report_attempt(cekpaham, **serializer.validated_data)
        safe(lambda: notify_events.cekpaham_reported(report))
        return Response(_student_detail(cekpaham), status=status.HTTP_201_CREATED)
