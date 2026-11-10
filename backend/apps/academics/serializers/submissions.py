"""Serializer jawaban: status mahasiswa, draf, antrean dan detail dosen, nilai."""

from __future__ import annotations

from rest_framework import serializers

from apps.academics.limits import MAX_ANSWER_CHARS, MIN_ANSWER_WORDS
from apps.academics.models import Assignment, ReasoningEvent, Submission
from apps.academics.services.documents import original_exists
from apps.academics.services.rich_text import clean_rich_doc, rich_to_plain
from apps.analysis.engines.similarity import most_similar
from apps.analysis.engines.style_markers import find_style_markers
from apps.analysis.models import AnalysisResult, AnalysisRun


class StudentSubmissionStatusSerializer(serializers.ModelSerializer):
    document_id = serializers.UUIDField(source="source_document", read_only=True)

    # Sengaja tanpa ai_score/signals: hasil analisis AI tidak pernah ditampilkan ke mahasiswa.
    class Meta:
        model = Submission
        fields = [
            "id",
            "status",
            "submitted_at",
            "grade",
            "teacher_feedback",
            "text_answer",
            "rich_answer",
            "is_imported",
            "document_id",
            "revision_count",
        ]


class StudentSubmissionStatusListSerializer(StudentSubmissionStatusSerializer):
    """Varian listing tanpa text_answer (isi esai hanya lewat endpoint detail)."""

    class Meta(StudentSubmissionStatusSerializer.Meta):
        fields = [
            field
            for field in StudentSubmissionStatusSerializer.Meta.fields
            if field not in ("text_answer", "rich_answer")
        ]


class SubmissionGradeSerializer(serializers.Serializer):
    grade = serializers.IntegerField(min_value=0, max_value=100)
    teacher_feedback = serializers.CharField(required=False, allow_blank=True, default="")


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
            "is_imported",
            "analysis_state",
            "analysis",
        ]

    def get_student(self, obj: Submission) -> dict:
        profile = obj.student_profile
        return {"id": str(profile.id), "display_name": profile.label}

    def get_analysis(self, obj: Submission) -> dict | None:
        analysis = getattr(obj, "analysis", None)
        if analysis is None:
            return None
        return {
            "ai_band": analysis.ai_band,
            "bloom_level": analysis.bloom_level,
            "process_band": analysis.process_band,
        }


class SubmissionQueueSerializer(SubmissionListSerializer):
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)
    class_id = serializers.UUIDField(source="assignment.class_ref_id", read_only=True)
    class_name = serializers.CharField(source="assignment.class_ref.name", read_only=True)

    class Meta(SubmissionListSerializer.Meta):
        fields = SubmissionListSerializer.Meta.fields + [
            "assignment_title",
            "class_id",
            "class_name",
        ]


class ProgressSampleSerializer(serializers.Serializer):
    """Satu cuplikan jumlah kata pada satu titik waktu."""

    at = serializers.DateTimeField()
    word_count = serializers.IntegerField(min_value=0, max_value=100_000)


def _resolve_answer(attrs: dict) -> dict:
    """text_answer SELALU diturunkan server dari rich_answer, agar tak bisa beda dari yang dilihat dosen."""
    rich = attrs.get("rich_answer")
    if rich is not None:
        cleaned = clean_rich_doc(rich)
        attrs["rich_answer"] = cleaned
        attrs["text_answer"] = rich_to_plain(cleaned)
    elif "text_answer" not in attrs:
        raise serializers.ValidationError({"text_answer": "Jawaban wajib diisi."})
    if len(attrs["text_answer"]) > MAX_ANSWER_CHARS:
        raise serializers.ValidationError({"text_answer": "Jawaban terlalu panjang."})
    return attrs


class DraftSaveSerializer(serializers.Serializer):
    # Boleh kosong (mahasiswa menghapus semuanya); kosong tidak memulai pengerjaan.
    text_answer = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    rich_answer = serializers.JSONField(required=False, allow_null=True)
    document_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        return _resolve_answer(attrs)


class SubmissionCreateSerializer(serializers.Serializer):
    text_answer = serializers.CharField(required=False, trim_whitespace=False)
    rich_answer = serializers.JSONField(required=False, allow_null=True)
    # Server memeriksa teks memang berasal dari dokumen ini; klaimnya tidak melewatkan apa pun.
    document_id = serializers.UUIDField(required=False)
    # Diterima tetapi DIABAIKAN (bundel frontend lama); jejak dicatat server dari draf.
    started_at = serializers.DateTimeField(required=False)
    progress = ProgressSampleSerializer(many=True, required=False, max_length=240)

    def validate(self, attrs):
        attrs = _resolve_answer(attrs)
        # Jawaban dari dokumen: ketikan boleh hanya nama/NIM; batasnya diperiksa setelah teks digabung.
        if (
            attrs.get("document_id") is None
            and len(attrs["text_answer"].split()) < MIN_ANSWER_WORDS
        ):
            raise serializers.ValidationError(
                {"text_answer": f"Tulis minimal {MIN_ANSWER_WORDS} kata sebelum mengumpulkan."}
            )
        return attrs


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
            "process_band",
            "process_evidence",
        ]


class AssignmentMiniSerializer(serializers.ModelSerializer):
    # Dipakai halaman detail submission untuk kembali ke kelas asalnya.
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    education_level = serializers.CharField(source="class_ref.education_level", read_only=True)
    program_studi = serializers.CharField(source="class_ref.program_studi", read_only=True)
    semester = serializers.IntegerField(source="class_ref.semester", read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "class_id",
            "title",
            "instructions",
            "instructions_rich",
            "expected_bloom_level",
            "education_level",
            "program_studi",
            "semester",
        ]


class AnalysisRunSerializer(serializers.ModelSerializer):
    """Satu baris riwayat analisis; payload lengkap sengaja tidak dikirim."""

    class Meta:
        model = AnalysisRun
        fields = [
            "id",
            "trigger",
            "created_at",
            "ai_score",
            "ai_band",
            "bloom_level",
            "analysis_source",
        ]


class SubmissionDetailSerializer(serializers.ModelSerializer):
    assignment = AssignmentMiniSerializer(read_only=True)
    student = serializers.SerializerMethodField()
    reasoning_events = serializers.SerializerMethodField()
    analysis = serializers.SerializerMethodField()
    analysis_history = serializers.SerializerMethodField()
    style_markers = serializers.SerializerMethodField()
    similar_submissions = serializers.SerializerMethodField()
    document_available = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "student",
            "text_answer",
            "rich_answer",
            "is_imported",
            "document_available",
            "started_at",
            "submitted_at",
            "duration_seconds",
            "revision_count",
            "status",
            "grade",
            "teacher_feedback",
            "reasoning_events",
            "analysis_state",
            "analysis",
            "analysis_history",
            "style_markers",
            "similar_submissions",
        ]

    def get_document_available(self, obj: Submission) -> bool:
        if obj.source_document is None:
            return False
        return original_exists(obj.student_profile_id, obj.source_document)

    def get_style_markers(self, obj: Submission) -> dict:
        # Dihitung dari teks saat dibuka (murah), sehingga pengumpulan lama pun ikut tercakup.
        return find_style_markers(obj.text_answer)

    def get_similar_submissions(self, obj: Submission) -> list:
        # Import lokal agar modul serializer tetap ringan saat dimuat banyak view.
        from apps.academics.services.suggestion import peers_of

        return most_similar(obj.text_answer, peers_of(obj))

    def get_student(self, obj: Submission) -> dict:
        profile = obj.student_profile
        return {"id": str(profile.id), "display_name": profile.label}

    def get_analysis_history(self, obj: Submission) -> list:
        # Urutan terbaru-dulu berasal dari Prefetch di selectors.
        return AnalysisRunSerializer(obj.analysis_runs.all(), many=True).data

    def get_reasoning_events(self, obj: Submission) -> list:
        # Urutan dari Prefetch di views; .order_by() di sini membuang prefetch (query per baris).
        events = obj.reasoning_events.all()
        return ReasoningEventSerializer(events, many=True).data

    def get_analysis(self, obj: Submission) -> dict | None:
        analysis = getattr(obj, "analysis", None)
        if analysis is None:
            return None
        return AnalysisFullSerializer(analysis).data
