from __future__ import annotations

from rest_framework import serializers

from .models import AnalysisResult, Assignment, Class, ReasoningEvent, Submission


# --- Classes ---------------------------------------------------------------


class ClassListSerializer(serializers.ModelSerializer):
    assignment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Class
        fields = [
            "id",
            "name",
            "subject",
            "education_level",
            "program_studi",
            "semester",
            "join_code",
            "assignment_count",
            "created_at",
        ]


class ClassCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ["name", "subject", "education_level", "program_studi", "semester"]


# --- Assignments -----------------------------------------------------------


class AssignmentListSerializer(serializers.ModelSerializer):
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    # Jenjang tidak lagi disimpan di Assignment. Dipaparkan dari kelasnya supaya
    # kontrak API tidak berubah. Queryset pemanggil wajib select_related.
    education_level = serializers.CharField(
        source="class_ref.education_level", read_only=True
    )
    submission_count = serializers.IntegerField(read_only=True)
    high_band_count = serializers.IntegerField(read_only=True)
    needs_review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "class_id",
            "title",
            "instructions",
            "deadline",
            "expected_bloom_level",
            "education_level",
            "submission_count",
            "high_band_count",
            "needs_review_count",
            "created_at",
        ]


class AssignmentCreateSerializer(serializers.ModelSerializer):
    """Jenjang sengaja tidak diterima di sini.

    Tugas mewarisi jenjang dari kelas tempatnya dibuat. Menerimanya sebagai
    masukan membuka kemungkinan tugas tersimpan dengan jenjang berbeda dari
    kelasnya, yang tidak punya arti apa pun.
    """

    expected_bloom_level = serializers.IntegerField(min_value=1, max_value=6)
    deadline = serializers.DateTimeField(required=True)

    class Meta:
        model = Assignment
        fields = [
            "title",
            "instructions",
            "deadline",
            "expected_bloom_level",
        ]


# --- Akses mahasiswa (join + daftar kelas) ---------------------------------------


class JoinClassSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=16)

    def validate_join_code(self, value: str) -> str:
        return value.strip().upper()


class ClassPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ["id", "name", "subject", "education_level", "program_studi", "semester"]


class StudentAssignmentSerializer(serializers.ModelSerializer):
    education_level = serializers.CharField(
        source="class_ref.education_level", read_only=True
    )

    class Meta:
        model = Assignment
        fields = [
            "id",
            "title",
            "instructions",
            "deadline",
            "expected_bloom_level",
            "education_level",
        ]


class StudentSubmissionStatusSerializer(serializers.ModelSerializer):
    # Sengaja tanpa ai_score/signals: mahasiswa tidak melihat hasil analisis AI,
    # hanya jawabannya sendiri, status, nilai, dan umpan balik dosen.
    class Meta:
        model = Submission
        fields = [
            "id",
            "status",
            "submitted_at",
            "grade",
            "teacher_feedback",
            "text_answer",
            "revision_count",
        ]


class SubmissionGradeSerializer(serializers.Serializer):
    grade = serializers.IntegerField(min_value=0, max_value=100)
    teacher_feedback = serializers.CharField(
        required=False, allow_blank=True, default=""
    )


# --- Submissions -----------------------------------------------------------


class StudentMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()


class AnalysisMiniSerializer(serializers.Serializer):
    ai_band = serializers.CharField()
    bloom_level = serializers.IntegerField()


class SubmissionListSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    analysis = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment_id",
            "student",
            "submitted_at",
            "duration_seconds",
            "revision_count",
            "status",
            "grade",
            "analysis",
        ]

    def get_student(self, obj: Submission) -> dict:
        profile = obj.student_profile
        return {"id": str(profile.id), "display_name": profile.display_name or profile.email}

    def get_analysis(self, obj: Submission) -> dict | None:
        analysis = getattr(obj, "analysis", None)
        if analysis is None:
            return None
        return {"ai_band": analysis.ai_band, "bloom_level": analysis.bloom_level}


class SubmissionCreateSerializer(serializers.Serializer):
    text_answer = serializers.CharField(min_length=50)
    started_at = serializers.DateTimeField(required=False)


class ReasoningEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReasoningEvent
        fields = ["event_type", "occurred_at", "payload"]


class AnalysisFullSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisResult
        fields = [
            "ai_score",
            "ai_band",
            "bloom_level",
            "confidence",
            "bloom_confidence",
            "signals",
            "signal_breakdown",
            "summary",
            "recommendation",
            "analysis_source",
        ]


class AssignmentMiniSerializer(serializers.ModelSerializer):
    education_level = serializers.CharField(
        source="class_ref.education_level", read_only=True
    )
    program_studi = serializers.CharField(
        source="class_ref.program_studi", read_only=True
    )
    semester = serializers.IntegerField(source="class_ref.semester", read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "title",
            "expected_bloom_level",
            "education_level",
            "program_studi",
            "semester",
        ]


class SubmissionDetailSerializer(serializers.ModelSerializer):
    assignment = AssignmentMiniSerializer(read_only=True)
    student = serializers.SerializerMethodField()
    reasoning_events = serializers.SerializerMethodField()
    analysis = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "student",
            "text_answer",
            "started_at",
            "submitted_at",
            "duration_seconds",
            "revision_count",
            "status",
            "grade",
            "teacher_feedback",
            "reasoning_events",
            "analysis",
        ]

    def get_student(self, obj: Submission) -> dict:
        profile = obj.student_profile
        return {"id": str(profile.id), "display_name": profile.display_name or profile.email}

    def get_reasoning_events(self, obj: Submission) -> list:
        events = obj.reasoning_events.order_by("occurred_at")
        return ReasoningEventSerializer(events, many=True).data

    def get_analysis(self, obj: Submission) -> dict | None:
        analysis = getattr(obj, "analysis", None)
        if analysis is None:
            return None
        return AnalysisFullSerializer(analysis).data
