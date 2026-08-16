from __future__ import annotations

from rest_framework import serializers

from .models import (
    AnalysisResult,
    Assignment,
    Class,
    ReasoningEvent,
    Submission,
    VerbalVerification,
    VerificationOutcome,
    VerificationStatus,
)


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


class TeacherAssignmentRowSerializer(AssignmentListSerializer):
    """Baris daftar tugas lintas kelas.

    Sama seperti daftar per kelas, ditambah nama kelas karena di halaman ini
    tugas dari beberapa kelas bercampur dan judul saja tidak cukup untuk
    membedakannya.
    """

    class_name = serializers.CharField(source="class_ref.name", read_only=True)
    subject = serializers.CharField(source="class_ref.subject", read_only=True)

    class Meta(AssignmentListSerializer.Meta):
        fields = AssignmentListSerializer.Meta.fields + ["class_name", "subject"]


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


class StudentSubmissionStatusListSerializer(StudentSubmissionStatusSerializer):
    """Varian listing: tanpa text_answer.

    Daftar kelas mahasiswa tidak menampilkan isi esai, jadi mengirimnya berarti
    mengangkut seluruh tulisan yang pernah dibuat mahasiswa pada setiap buka
    halaman. Teks tetap tersedia lewat endpoint detail tugas.
    """

    class Meta(StudentSubmissionStatusSerializer.Meta):
        fields = [
            field
            for field in StudentSubmissionStatusSerializer.Meta.fields
            if field != "text_answer"
        ]


class SubmissionGradeSerializer(serializers.Serializer):
    grade = serializers.IntegerField(min_value=0, max_value=100)
    teacher_feedback = serializers.CharField(
        required=False, allow_blank=True, default=""
    )


# --- Submissions -----------------------------------------------------------


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
        return {"id": str(profile.id), "display_name": profile.label}

    def get_analysis(self, obj: Submission) -> dict | None:
        analysis = getattr(obj, "analysis", None)
        if analysis is None:
            return None
        return {"ai_band": analysis.ai_band, "bloom_level": analysis.bloom_level}


class ProgressSampleSerializer(serializers.Serializer):
    """Satu cuplikan jumlah kata pada satu titik waktu."""

    at = serializers.DateTimeField()
    word_count = serializers.IntegerField(min_value=0, max_value=100_000)


class SubmissionCreateSerializer(serializers.Serializer):
    text_answer = serializers.CharField(min_length=50)
    started_at = serializers.DateTimeField(required=False)
    # Dibatasi supaya satu permintaan tidak bisa membanjiri basis data. Dengan
    # cuplikan tiap 30 detik, 240 sampel setara dua jam pengerjaan.
    progress = ProgressSampleSerializer(many=True, required=False, max_length=240)


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


class VerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerbalVerification
        fields = [
            "status",
            "scheduled_at",
            "outcome",
            "notes",
            "completed_at",
            "updated_at",
        ]


class VerificationWriteSerializer(serializers.Serializer):
    """Satu endpoint untuk menjadwalkan maupun mencatat hasil.

    outcome hanya sah ketika status completed. Menerima outcome pada sesi yang
    baru dijadwalkan berarti membiarkan dosen menyimpulkan sebelum berbicara,
    yang justru kebalikan dari tujuan fitur ini.
    """

    status = serializers.ChoiceField(choices=VerificationStatus.choices)
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    outcome = serializers.ChoiceField(
        choices=VerificationOutcome.choices, required=False, allow_blank=True
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        status_value = attrs.get("status")
        outcome = attrs.get("outcome") or ""

        if status_value == VerificationStatus.COMPLETED and not outcome:
            raise serializers.ValidationError(
                {"outcome": "Sesi yang sudah selesai wajib punya kesimpulan."}
            )
        if status_value != VerificationStatus.COMPLETED and outcome:
            raise serializers.ValidationError(
                {
                    "outcome": (
                        "Kesimpulan hanya boleh diisi setelah sesi berlangsung."
                    )
                }
            )
        if status_value == VerificationStatus.SCHEDULED and not attrs.get(
            "scheduled_at"
        ):
            raise serializers.ValidationError(
                {"scheduled_at": "Sesi terjadwal wajib punya waktu."}
            )
        return attrs


class VerificationQueueSerializer(serializers.ModelSerializer):
    """Baris antrean verifikasi lintas kelas."""

    submission_id = serializers.UUIDField(read_only=True)
    student_name = serializers.SerializerMethodField()
    assignment_title = serializers.CharField(
        source="submission.assignment.title", read_only=True
    )
    class_name = serializers.CharField(
        source="submission.assignment.class_ref.name", read_only=True
    )
    ai_band = serializers.SerializerMethodField()

    class Meta:
        model = VerbalVerification
        fields = [
            "submission_id",
            "student_name",
            "assignment_title",
            "class_name",
            "ai_band",
            "status",
            "scheduled_at",
            "outcome",
            "completed_at",
        ]

    def get_student_name(self, obj) -> str:
        return obj.submission.student_profile.label

    def get_ai_band(self, obj) -> str:
        analysis = getattr(obj.submission, "analysis", None)
        return analysis.ai_band if analysis else ""


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
    verification = serializers.SerializerMethodField()

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
            "verification",
        ]

    def get_student(self, obj: Submission) -> dict:
        profile = obj.student_profile
        return {"id": str(profile.id), "display_name": profile.label}

    def get_reasoning_events(self, obj: Submission) -> list:
        # Urutan occurred_at berasal dari Prefetch di views. .order_by() di
        # sini akan membuang hasil prefetch dan memicu query baru per baris.
        events = obj.reasoning_events.all()
        return ReasoningEventSerializer(events, many=True).data

    def get_analysis(self, obj: Submission) -> dict | None:
        analysis = getattr(obj, "analysis", None)
        if analysis is None:
            return None
        return AnalysisFullSerializer(analysis).data

    def get_verification(self, obj: Submission) -> dict | None:
        verification = getattr(obj, "verification", None)
        if verification is None:
            return None
        return VerificationSerializer(verification).data
