from __future__ import annotations

from rest_framework import serializers

from apps.academics.services.rich_text import clean_rich_doc, rich_to_plain
from apps.academics.models import (
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
            "rich_answer",
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
            if field not in ("text_answer", "rich_answer")
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


# Jawaban minimal sekian kata sebelum boleh dikumpulkan (draf tidak dibatasi).
MIN_ANSWER_WORDS = 5


def _resolve_answer(attrs: dict) -> dict:
    """Satukan jawaban kaya dan teks polos: teks polos SELALU diturunkan server dari dokumen.

    Klien yang mengirim `rich_answer` tidak bisa menyelipkan `text_answer` yang berbeda dari yang
    dilihat dosen; bila hanya `text_answer` yang dikirim (klien lama), jawabannya teks polos.
    """
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
    text_answer = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False
    )
    rich_answer = serializers.JSONField(required=False, allow_null=True)
    document_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        return _resolve_answer(attrs)


class SubmissionCreateSerializer(serializers.Serializer):
    text_answer = serializers.CharField(required=False, trim_whitespace=False)
    rich_answer = serializers.JSONField(required=False, allow_null=True)
    # Hasil unggahan dokumen (DocumentImportView); server memeriksa bahwa teks
    # memang berasal darinya, jadi klaim ini tidak membuat apa pun dilewati.
    document_id = serializers.UUIDField(required=False)
    # DITERIMA TETAPI DIABAIKAN: bundel frontend lama masih mengirim keduanya
    # (frontend dan backend dideploy terpisah). Jejak pengerjaan kini dicatat
    # server dari draf (lihat services/drafts.py); hapus dua kolom ini bila
    # semua klien sudah memakai penyimpanan otomatis.
    started_at = serializers.DateTimeField(required=False)
    progress = ProgressSampleSerializer(many=True, required=False, max_length=240)

    def validate(self, attrs):
        attrs = _resolve_answer(attrs)
        if len(attrs["text_answer"].split()) < MIN_ANSWER_WORDS:
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
            "rich_answer",
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
