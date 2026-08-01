from rest_framework import serializers

from .models import EducationLevel, Profile, Role


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


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, max_length=128)
    display_name = serializers.CharField(max_length=120)
    role = serializers.ChoiceField(choices=Role.choices)

    def validate_email(self, value: str) -> str:
        if Profile.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email sudah terdaftar.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128)


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
