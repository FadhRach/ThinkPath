"""Serializer Cek Paham. Dosen dan mahasiswa dipisah sengaja.

Serializer mahasiswa TIDAK punya field soal, skor, band, flag, dimensi, atau
ringkasan penilai. Soal hanya keluar dari endpoint `start`, dan aturan ini
dijaga tes yang memeriksa daftar field.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.cekpaham.models import (
    MAX_ANSWER_SECONDS,
    MIN_ANSWER_SECONDS,
    AttemptStatus,
    CekPaham,
    CekPahamAttempt,
    CekPahamReport,
    Language,
    ReportReason,
)
from apps.cekpaham.selectors import live_attempt, phase_of
from apps.cekpaham.services.gate import consent_state
from apps.cekpaham.services.lifecycle import MAX_REPORTS_PER_ATTEMPT, REPORTABLE

NOTE_MAX = 1000
# Ambang band belum dikalibrasi (rubric.py); UI wajib menampilkan label ini.
CALIBRATED = False


class CekPahamCreateSerializer(serializers.Serializer):
    question_text = serializers.CharField(min_length=10, max_length=1000)
    language = serializers.ChoiceField(choices=Language.choices)
    answer_seconds = serializers.IntegerField(min_value=MIN_ANSWER_SECONDS, max_value=MAX_ANSWER_SECONDS)
    window_start = serializers.DateTimeField()
    window_end = serializers.DateTimeField()

    def validate(self, attrs: dict) -> dict:
        if attrs["window_end"] <= attrs["window_start"]:
            raise serializers.ValidationError({"window_end": "Batas akhir harus setelah waktu mulai."})
        return attrs


class ReportCreateSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=ReportReason.choices, required=False, default=ReportReason.OTHER)
    note = serializers.CharField(max_length=NOTE_MAX, required=False, allow_blank=True, default="")


class ReportResolveSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(choices=("dismissed", "grant_retry"))
    response_note = serializers.CharField(max_length=NOTE_MAX, required=False, allow_blank=True, default="")
    extend_window_to = serializers.DateTimeField(required=False, allow_null=True, default=None)


# --- dosen -----------------------------------------------------------------

class ReportTeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = CekPahamReport
        fields = ["id", "reason", "note", "status", "created_at", "resolved_at", "response_note"]


class AttemptTeacherSerializer(serializers.ModelSerializer):
    audio_available = serializers.SerializerMethodField()
    reports = ReportTeacherSerializer(many=True, read_only=True)

    class Meta:
        model = CekPahamAttempt
        fields = [
            "id", "number", "status", "started_at", "deadline_at", "finalized_at",
            "audio_available", "audio_duration_s", "first_speech_offset_s",
            "live_transcript", "final_transcript", "asr_model", "asr_quality", "client_events",
            "ai_score", "ai_band", "ai_dimensions", "ai_flags", "ai_summary",
            "judge_model", "rubric_version", "judge_runs", "error_code", "reports",
        ]

    def get_audio_available(self, attempt: CekPahamAttempt) -> bool:
        return bool(attempt.audio_path)


class CekPahamTeacherSerializer(serializers.ModelSerializer):
    """Satu baris antrean/daftar: ringkas, tanpa transkrip."""

    submission_id = serializers.UUIDField(read_only=True)
    student_name = serializers.CharField(source="submission.student_profile.display_name", read_only=True)
    assignment_title = serializers.CharField(source="submission.assignment.title", read_only=True)
    class_name = serializers.CharField(source="submission.assignment.class_ref.name", read_only=True)
    class_id = serializers.UUIDField(source="submission.assignment.class_ref_id", read_only=True)
    student_id = serializers.UUIDField(source="submission.student_profile_id", read_only=True)
    phase = serializers.SerializerMethodField()
    attempt = serializers.SerializerMethodField()

    class Meta:
        model = CekPaham
        fields = [
            "id", "submission_id", "student_id", "student_name", "assignment_title",
            "class_id", "class_name",
            "question_text", "language", "answer_seconds", "window_start", "window_end",
            "status", "phase", "created_at", "cancelled_at", "attempt",
        ]

    def get_phase(self, cekpaham: CekPaham) -> str:
        return phase_of(cekpaham)

    def get_attempt(self, cekpaham: CekPaham) -> dict | None:
        attempt = live_attempt(cekpaham)
        if attempt is None:
            return None
        return {
            "number": attempt.number,
            "status": attempt.status,
            "ai_score": attempt.ai_score,
            "ai_band": attempt.ai_band,
            "finalized_at": attempt.finalized_at,
            "open_reports": sum(1 for r in attempt.reports.all() if r.status == "open"),
        }


class CekPahamDetailSerializer(CekPahamTeacherSerializer):
    attempts = AttemptTeacherSerializer(many=True, read_only=True)
    student_consent_ready = serializers.SerializerMethodField()
    calibrated = serializers.SerializerMethodField()

    class Meta(CekPahamTeacherSerializer.Meta):
        fields = CekPahamTeacherSerializer.Meta.fields + ["keyterms", "attempts", "student_consent_ready", "calibrated"]

    def get_student_consent_ready(self, cekpaham: CekPaham) -> bool:
        return consent_state(cekpaham.submission.student_profile_id)["ready"]

    def get_calibrated(self, cekpaham: CekPaham) -> bool:
        return CALIBRATED


# --- mahasiswa -------------------------------------------------------------

STUDENT_STATE = {
    AttemptStatus.IN_PROGRESS: "in_progress",
    AttemptStatus.PROCESSING: "processing",
    AttemptStatus.SCORED: "done",
    AttemptStatus.PROCESSING_FAILED: "failed",
    AttemptStatus.INTERRUPTED: "interrupted",
}


class ReportStudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CekPahamReport
        fields = ["reason", "status", "created_at", "response_note"]


class StudentCekPahamSerializer(serializers.ModelSerializer):
    """Metadata netral. Tanpa soal (hanya dari `start`), skor, band, atau flag."""

    assignment_title = serializers.CharField(source="submission.assignment.title", read_only=True)
    class_name = serializers.CharField(source="submission.assignment.class_ref.name", read_only=True)
    phase = serializers.SerializerMethodField()
    consent = serializers.SerializerMethodField()
    attempt = serializers.SerializerMethodField()

    class Meta:
        model = CekPaham
        fields = [
            "id", "assignment_title", "class_name", "language", "answer_seconds",
            "window_start", "window_end", "phase", "consent", "attempt",
        ]

    def get_phase(self, cekpaham: CekPaham) -> str:
        return phase_of(cekpaham)

    def get_consent(self, cekpaham: CekPaham) -> dict:
        return consent_state(cekpaham.submission.student_profile_id)

    def get_attempt(self, cekpaham: CekPaham) -> dict | None:
        attempt = live_attempt(cekpaham)
        if attempt is None:
            return None
        reports = list(attempt.reports.all())
        return {
            "number": attempt.number,
            "state": STUDENT_STATE[attempt.status],
            "transcript": attempt.final_transcript,
            "can_report": attempt.status in REPORTABLE and len(reports) < MAX_REPORTS_PER_ATTEMPT,
            "reports": ReportStudentSerializer(reports, many=True).data,
        }
