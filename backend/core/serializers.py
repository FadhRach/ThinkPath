from rest_framework import serializers

from . import privacy
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
    # Peran yang dipilih di layar login. Bila dikirim, wajib sama dengan peran
    # akun. Sengaja opsional: frontend (Vercel) dan backend (HF Spaces) di-deploy
    # terpisah, dan frontend lama yang belum mengirim peran tidak boleh ikut
    # gagal login. Ini penjaga pengalaman pengguna, bukan kontrol akses; hak
    # akses tetap ditentukan klaim peran di token.
    role = serializers.ChoiceField(choices=Role.choices, required=False)


class ConsentGiveSerializer(serializers.Serializer):
    """Persetujuan yang diberikan dari layar persetujuan.

    Versi dikirim frontend dan wajib sama dengan versi backend, supaya yang
    tercatat benar-benar versi kebijakan yang dibaca pengguna. Selisih versi
    hanya terjadi sesaat ketika frontend dan backend belum sama-sama diperbarui.
    """

    policy_version = serializers.CharField(max_length=20)
    items = serializers.ListField(
        child=serializers.CharField(max_length=40), max_length=10
    )

    def validate(self, attrs: dict) -> dict:
        if attrs["policy_version"] != privacy.PRIVACY_POLICY_VERSION:
            raise serializers.ValidationError(
                "Kebijakan Privasi baru saja diperbarui. Muat ulang halaman, baca "
                "versi terbarunya, lalu setujui kembali."
            )
        role = self.context["role"]
        items = set(attrs["items"])
        required = set(privacy.REQUIRED_ITEMS[role])
        unknown = items - required - set(privacy.OPTIONAL_ITEMS[role])
        if unknown:
            raise serializers.ValidationError(
                f"Butir persetujuan tidak dikenal: {', '.join(sorted(unknown))}."
            )
        if not required <= items:
            raise serializers.ValidationError(
                "Semua butir wajib perlu disetujui untuk memakai ThinkPath."
            )
        attrs["items"] = sorted(items)
        return attrs


class ConsentUpdateSerializer(serializers.Serializer):
    """Mengubah pilihan opsional tanpa menarik persetujuan wajib."""

    external_ai = serializers.BooleanField()


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
