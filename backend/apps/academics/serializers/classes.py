"""Serializer kelas: daftar, buat, gabung."""

from __future__ import annotations

from rest_framework import serializers

from apps.academics.models import Class


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


class JoinClassSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=16)

    def validate_join_code(self, value: str) -> str:
        return value.strip().upper()


class ClassPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = [
            "id",
            "name",
            "subject",
            "education_level",
            "program_studi",
            "semester",
            "is_archived",
            "owner_left_at",
        ]
