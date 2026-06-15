from rest_framework import serializers

from .models import EducationLevel, Profile


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "id",
            "email",
            "display_name",
            "role",
            "education_level",
            "created_at",
        ]
        read_only_fields = ["id", "email", "role", "created_at"]


class ProfilePatchSerializer(serializers.Serializer):
    display_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True
    )
    education_level = serializers.ChoiceField(
        choices=EducationLevel.choices, required=False, allow_blank=True
    )

    def update(self, instance: Profile, validated_data: dict) -> Profile:
        for field in ("display_name", "education_level"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance
