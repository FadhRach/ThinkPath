from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
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


# Pesan untuk bundel frontend lama yang belum mengirim kolom persetujuan:
# frontend (Vercel) dan backend (VPS) dideploy terpisah.
STALE_BUNDLE = {"required": "Halaman sudah usang. Muat ulang halaman, lalu coba lagi."}


# Pesan bawaan validator Django ada di locale django.contrib.auth, yang tidak
# terpasang di sini (identitas dikelola sendiri), jadi tampil berbahasa Inggris.
# Dipetakan lewat kode galatnya supaya pengguna membaca bahasa Indonesia.
PASSWORD_MESSAGES = {
    "password_too_short": "Kata sandi minimal 10 karakter.",
    "password_too_common": "Kata sandi ini terlalu umum dipakai. Pilih yang lebih unik.",
    "password_entirely_numeric": "Kata sandi tidak boleh hanya berisi angka.",
    "password_too_similar": "Kata sandi terlalu mirip dengan email atau namamu.",
}


def check_password_strength(password: str, *, email: str = "", display_name: str = "") -> str:
    """Terapkan AUTH_PASSWORD_VALIDATORS pada sandi baru; galatnya berbahasa Indonesia."""
    try:
        validate_password(password, user=Profile(email=email, display_name=display_name))
    except DjangoValidationError as exc:
        raise serializers.ValidationError(
            [PASSWORD_MESSAGES.get(error.code, "Kata sandi belum memenuhi syarat.") for error in exc.error_list]
        ) from exc
    return password


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128)
    display_name = serializers.CharField(max_length=120)
    role = serializers.ChoiceField(choices=Role.choices)
    # Satu centang di form daftar. Kedua field ini hanya untuk pemeriksaan dan
    # dibuang sebelum akun dibuat; yang tersimpan adalah baris persetujuan.
    accept_policy = serializers.BooleanField(error_messages=STALE_BUNDLE)
    policy_version = serializers.CharField(max_length=20, error_messages=STALE_BUNDLE)

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

    def validate(self, attrs: dict) -> dict:
        # Setelah email dan nama tersedia, supaya sandi yang mirip keduanya ditolak.
        check_password_strength(
            attrs["password"], email=attrs["email"], display_name=attrs["display_name"]
        )
        return attrs


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


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(max_length=128)
    new_password = serializers.CharField(max_length=128)

    def validate_current_password(self, value: str) -> str:
        if not self.context["profile"].check_password(value):
            raise serializers.ValidationError("Kata sandi saat ini salah.")
        return value

    def validate(self, attrs: dict) -> dict:
        profile = self.context["profile"]
        if attrs["new_password"] == attrs["current_password"]:
            raise serializers.ValidationError({"new_password": ["Kata sandi baru harus berbeda dari yang lama."]})
        check_password_strength(
            attrs["new_password"], email=profile.email, display_name=profile.display_name
        )
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=200)
    new_password = serializers.CharField(max_length=128)

    def validate(self, attrs: dict) -> dict:
        from apps.accounts.password_reset import INVALID_LINK, find_valid

        row = find_valid(attrs["token"])
        if row is None:
            raise serializers.ValidationError({"token": [INVALID_LINK]})
        check_password_strength(
            attrs["new_password"], email=row.profile.email, display_name=row.profile.display_name
        )
        attrs["row"] = row
        return attrs


class AccountDeleteSerializer(serializers.Serializer):
    password = serializers.CharField(max_length=128)
    confirm = serializers.CharField(max_length=20)

    def validate_confirm(self, value: str) -> str:
        from apps.accounts.deletion import CONFIRM_PHRASE

        if value.strip() != CONFIRM_PHRASE:
            raise serializers.ValidationError(f'Ketik "{CONFIRM_PHRASE}" untuk mengonfirmasi.')
        return value

    def validate_password(self, value: str) -> str:
        if not self.context["profile"].check_password(value):
            raise serializers.ValidationError("Kata sandi salah.")
        return value
