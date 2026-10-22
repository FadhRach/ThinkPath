from rest_framework import serializers

from apps.accounts import privacy
from apps.accounts.models import EducationLevel, Profile, Role, normalize_email


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


def validate_policy_version(value: str) -> str:
    """Versi dikirim frontend dan wajib sama dengan versi backend, supaya yang
    tercatat benar-benar versi kebijakan yang dibaca pengguna. Selisih versi
    hanya terjadi sesaat ketika frontend dan backend belum sama-sama diperbarui.
    """
    if value != privacy.PRIVACY_POLICY_VERSION:
        raise serializers.ValidationError(
            "Kebijakan Privasi baru saja diperbarui. Muat ulang halaman, baca "
            "versi terbarunya, lalu setujui kembali."
        )
    return value


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, max_length=128)
    display_name = serializers.CharField(max_length=120)
    role = serializers.ChoiceField(choices=Role.choices)
    # Satu centang di form daftar. Kedua field ini hanya untuk pemeriksaan dan
    # dibuang sebelum akun dibuat; yang tersimpan adalah baris persetujuan.
    accept_policy = serializers.BooleanField()
    policy_version = serializers.CharField(max_length=20)

    def validate_accept_policy(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError(
                "Setujui Kebijakan Privasi untuk membuat akun."
            )
        return value

    def validate_policy_version(self, value: str) -> str:
        return validate_policy_version(value)

    def validate_email(self, value: str) -> str:
        value = normalize_email(value)
        if Profile.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email sudah terdaftar.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128)
    # Peran yang dipilih di layar login. Bila dikirim, wajib sama dengan peran
    # akun. Sengaja opsional: frontend (Vercel) dan backend (VPS) di-deploy
    # terpisah, dan frontend lama yang belum mengirim peran tidak boleh
    # ikut gagal login. Ini penjaga pengalaman pengguna, bukan kontrol akses; hak
    # akses tetap ditentukan klaim peran di token.
    role = serializers.ChoiceField(choices=Role.choices, required=False)


class ConsentGiveSerializer(serializers.Serializer):
    """Persetujuan ulang dari layar persetujuan (versi baru atau setelah ditarik).

    Butir yang disetujui ditentukan server dari peran, bukan dikirim klien.
    """

    policy_version = serializers.CharField(max_length=20)

    def validate_policy_version(self, value: str) -> str:
        return validate_policy_version(value)


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
