"""Serializer tugas: sisi dosen dan sisi mahasiswa."""

from __future__ import annotations

from rest_framework import serializers

from apps.academics.models import Assignment
from apps.academics.services.rich_text import clean_rich_doc, rich_to_plain


class AssignmentListSerializer(serializers.ModelSerializer):
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    # Jenjang tidak lagi disimpan di Assignment. Dipaparkan dari kelasnya supaya
    # kontrak API tidak berubah. Queryset pemanggil wajib select_related.
    education_level = serializers.CharField(source="class_ref.education_level", read_only=True)
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


class AssignmentDetailSerializer(AssignmentListSerializer):
    """Satu tugas, lengkap dengan instruksi berformat. Tidak dipakai di daftar: gambar di dalam
    instruksi bisa besar dan tidak perlu terkirim untuk setiap baris."""

    class Meta(AssignmentListSerializer.Meta):
        fields = AssignmentListSerializer.Meta.fields + ["instructions_rich"]


class AssignmentCreateSerializer(serializers.ModelSerializer):
    """Jenjang sengaja tidak diterima di sini.

    Tugas mewarisi jenjang dari kelas tempatnya dibuat. Menerimanya sebagai
    masukan membuka kemungkinan tugas tersimpan dengan jenjang berbeda dari
    kelasnya, yang tidak punya arti apa pun.
    """

    expected_bloom_level = serializers.IntegerField(min_value=1, max_value=6)
    deadline = serializers.DateTimeField(required=True)
    instructions_rich = serializers.JSONField(required=False, allow_null=True)

    def validate(self, attrs):
        # Teks polos selalu diturunkan server dari dokumen; klien tidak bisa mengirim keduanya
        # dengan isi berbeda. Hanya `instructions` (klien lama) berarti instruksi polos.
        rich = attrs.get("instructions_rich")
        if rich is not None:
            cleaned = clean_rich_doc(rich)
            attrs["instructions_rich"] = cleaned
            attrs["instructions"] = rich_to_plain(cleaned)
        elif "instructions" in attrs:
            attrs["instructions_rich"] = None
        return attrs

    class Meta:
        model = Assignment
        fields = [
            "title",
            "instructions",
            "instructions_rich",
            "deadline",
            "expected_bloom_level",
            "allow_file_upload",
        ]


class StudentAssignmentSerializer(serializers.ModelSerializer):
    education_level = serializers.CharField(source="class_ref.education_level", read_only=True)

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


class StudentAssignmentDetailSerializer(StudentAssignmentSerializer):
    """Halaman tugas mahasiswa: instruksi berformat ikut. Daftar kelas tidak memakainya."""

    class Meta(StudentAssignmentSerializer.Meta):
        fields = StudentAssignmentSerializer.Meta.fields + ["instructions_rich"]
