"""Serializer materi kelas."""

from __future__ import annotations

from rest_framework import serializers

from apps.academics.models import Material


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
