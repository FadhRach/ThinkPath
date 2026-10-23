from __future__ import annotations

from rest_framework import serializers

from apps.academics.models import (
    Announcement,
    Assignment,
    Class,
    Material,
    ReasoningEvent,
    Submission,
)
from apps.analysis.models import AnalysisResult, AnalysisRun


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


# --- Materials -------------------------------------------------------------


class MaterialSerializer(serializers.ModelSerializer):
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    # Queryset pemanggil wajib select_related("class_ref").
    class_name = serializers.CharField(source="class_ref.name", read_only=True)

    class Meta:
        model = Material
        fields = [
            "id",
            "class_id",
            "class_name",
            "topic",
            "title",
            "description",
            "url",
            "created_at",
        ]


class MaterialWriteSerializer(serializers.ModelSerializer):
    """Isian materi, dipakai saat dibagikan maupun saat diubah."""

    title = serializers.CharField(max_length=160)
    topic = serializers.CharField(required=False, allow_blank=True, max_length=80)
    description = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    url = serializers.URLField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Material
        fields = ["title", "topic", "description", "url"]

    def validate_topic(self, value: str) -> str:
        # Topik adalah kunci pengelompokan. "Pertemuan 3" dan "Pertemuan  3"
        # akan tampil sebagai dua kelompok terpisah di layar mahasiswa.
        return " ".join(value.split())

    def validate_url(self, value: str) -> str:
        # URLField bawaan juga menerima ftp. Di layar tautan ini dibuka dari
        # peramban mahasiswa, jadi hanya http dan https yang masuk akal.
        if value and not value.lower().startswith(("http://", "https://")):
            raise serializers.ValidationError("Tautan harus diawali http:// atau https://.")
        return value

    def validate(self, attrs: dict) -> dict:
        # Saat mengubah sebagian isian, kolom yang tidak dikirim tetap bernilai
        # seperti yang tersimpan, jadi syaratnya diperiksa pada hasil akhirnya.
        stored = self.instance
        description = attrs.get("description", stored.description if stored else "")
        url = attrs.get("url", stored.url if stored else "")
        if not description.strip() and not url.strip():
            raise serializers.ValidationError(
                "Isi ringkasan materi atau tautannya, minimal salah satu."
            )
        return attrs


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
            "allow_file_upload",
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
            "allow_file_upload",
        ]


# --- Akses mahasiswa (join + daftar kelas) ---------------------------------------


class JoinClassSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=16)

    def validate_join_code(self, value: str) -> str:
        return value.strip().upper()


class ClassPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = [
            "id", "name", "subject", "education_level", "program_studi", "semester",
            "is_archived", "owner_left_at",
        ]


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
            "allow_file_upload",
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
            "is_imported",
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


class AnnouncementSerializer(serializers.ModelSerializer):
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    author_name = serializers.SerializerMethodField()
    title = serializers.CharField(max_length=160)
    body = serializers.CharField(max_length=4000)

    class Meta:
        model = Announcement
        fields = ["id", "class_id", "author_name", "title", "body", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_author_name(self, obj: Announcement) -> str:
        owner = obj.class_ref.owner
        return owner.label if owner else "Dosen (akun telah dihapus)"


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


# ±3.000 kata. Esai kuliah wajar jauh di bawah ini; batas atas mencegah satu
# permintaan membakar kuota Winston/Groq dan memenuhi memori analisis.
MAX_ANSWER_CHARS = 20_000


class DraftSaveSerializer(serializers.Serializer):
    # Boleh kosong (mahasiswa menghapus semuanya); kosong tidak memulai pengerjaan.
    text_answer = serializers.CharField(allow_blank=True, max_length=MAX_ANSWER_CHARS, trim_whitespace=False)
    document_id = serializers.UUIDField(required=False, allow_null=True)


class SubmissionCreateSerializer(serializers.Serializer):
    text_answer = serializers.CharField(min_length=50, max_length=MAX_ANSWER_CHARS)
    # Hasil unggahan dokumen (DocumentImportView); server memeriksa bahwa teks
    # memang berasal darinya, jadi klaim ini tidak membuat apa pun dilewati.
    document_id = serializers.UUIDField(required=False)
    # DITERIMA TETAPI DIABAIKAN: bundel frontend lama masih mengirim keduanya
    # (frontend dan backend dideploy terpisah). Jejak pengerjaan kini dicatat
    # server dari draf (lihat services/drafts.py); hapus dua kolom ini bila
    # semua klien sudah memakai penyimpanan otomatis.
    started_at = serializers.DateTimeField(required=False)
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
            "process_band",
            "process_evidence",
        ]


class AssignmentMiniSerializer(serializers.ModelSerializer):
    # Dipakai halaman detail submission untuk kembali ke kelas asalnya.
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
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
            "class_id",
            "title",
            "expected_bloom_level",
            "education_level",
            "program_studi",
            "semester",
        ]


class AnalysisRunSerializer(serializers.ModelSerializer):
    """Satu baris riwayat analisis; payload lengkap sengaja tidak dikirim."""

    class Meta:
        model = AnalysisRun
        fields = ["id", "trigger", "created_at", "ai_score", "ai_band", "bloom_level", "analysis_source"]


class SubmissionDetailSerializer(serializers.ModelSerializer):
    assignment = AssignmentMiniSerializer(read_only=True)
    student = serializers.SerializerMethodField()
    reasoning_events = serializers.SerializerMethodField()
    analysis = serializers.SerializerMethodField()
    analysis_history = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "student",
            "text_answer",
            "is_imported",
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
        ]

    def get_student(self, obj: Submission) -> dict:
        profile = obj.student_profile
        return {"id": str(profile.id), "display_name": profile.label}

    def get_analysis_history(self, obj: Submission) -> list:
        # Urutan terbaru-dulu berasal dari Prefetch di selectors.
        return AnalysisRunSerializer(obj.analysis_runs.all(), many=True).data

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
