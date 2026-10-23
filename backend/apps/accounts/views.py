from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from apps.accounts.authentication import (
    create_access_token,
    create_upload_ticket,
    revoke_other_sessions,
    revoke_session,
)
from apps.accounts.models import ConsentAction, normalize_email
from apps.accounts.privacy import (
    SOURCE_REACCEPT,
    SOURCE_WITHDRAW,
    consent_status,
    current_consent,
    items_for,
    record_consent,
)
from apps.accounts.deletion import deletion_impact, delete_account
from apps.accounts.password_reset import confirm_reset, request_reset
from apps.accounts.serializers import (
    AccountDeleteSerializer,
    ConsentGiveSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    LoginSerializer,
    ProfilePatchSerializer,
    ProfileSerializer,
    RegisterSerializer,
)
from common.throttling import PerUserScopedThrottle
from apps.accounts.services import (
    authenticate_credentials,
    get_request_profile,
    register_profile,
)


ROLE_NAME = {"teacher": "dosen", "student": "mahasiswa"}
ROLE_OPTION = {"teacher": "Dosen", "student": "Mahasiswa"}


def role_mismatch_message(account_role: str) -> str:
    return (
        f"Akun ini terdaftar sebagai {ROLE_NAME[account_role]}. "
        f"Pilih peran {ROLE_OPTION[account_role]} untuk masuk."
    )


def _auth_response(profile) -> dict:
    return {
        "token": create_access_token(profile),
        "profile": ProfileSerializer(profile).data,
    }


class RegisterView(APIView):
    """POST daftar akun baru (dosen atau mahasiswa), langsung mengembalikan token."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Persetujuan dicatat bersama akun; token dibuat sesudahnya sehingga
        # sudah memuat klaim persetujuan dan pengguna langsung masuk aplikasi.
        profile = register_profile(
            email=data["email"],
            password=data["password"],
            display_name=data["display_name"],
            role=data["role"],
            consent=True,
        )
        return Response(_auth_response(profile), status=status.HTTP_201_CREATED)


class AccountLoginThrottle(SimpleRateThrottle):
    """Batas percobaan login per email, di samping batas per IP.

    Batas per IP saja membiarkan satu penyerang yang berpindah-pindah IP
    menebak sandi satu akun tanpa henti. Konsekuensi yang diterima: orang lain
    bisa membuat satu akun tidak bisa login selama satu menit; itu lebih murah
    daripada membiarkan tebakan tanpa batas.
    """

    scope = "auth_login_account"

    def get_cache_key(self, request, view):
        email = normalize_email(str(request.data.get("email", "")) if hasattr(request.data, "get") else "")
        return self.cache_format % {"scope": self.scope, "ident": email} if email else None


class LoginView(APIView):
    """POST login email + password, mengembalikan token dan profil."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "auth_login"
    throttle_classes = [ScopedRateThrottle, AccountLoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile = authenticate_credentials(data["email"], data["password"])
        if profile is None:
            return Response(
                {"detail": "Email atau kata sandi salah."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        # Diperiksa SETELAH kata sandi terbukti benar. Kalau urutannya dibalik,
        # siapa pun bisa menebak peran sebuah email tanpa tahu kata sandinya.
        requested_role = data.get("role")
        if requested_role and requested_role != profile.role:
            return Response(
                {"detail": role_mismatch_message(profile.role)},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(_auth_response(profile))


class PasswordResetRequestView(APIView):
    """POST minta tautan atur ulang sandi. Jawabannya sama untuk email terdaftar atau tidak."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_reset(serializer.validated_data["email"])
        return Response(
            {"detail": "Jika email itu terdaftar, tautan atur ulang sandi sudah dikirim. Cek kotak masuk dan folder spam."},
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetConfirmView(APIView):
    """POST pasang sandi baru dengan tautan dari email. Tidak langsung login."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirm_reset(serializer.validated_data["row"], serializer.validated_data["new_password"])
        return Response({"detail": "Kata sandi diperbarui. Silakan masuk dengan kata sandi baru."})


class MeView(APIView):
    """GET profil dari token aktif, PATCH update field yang diizinkan."""

    def get(self, request):
        profile = get_request_profile(request)
        return Response(ProfileSerializer(profile).data)

    def patch(self, request):
        profile = get_request_profile(request)
        serializer = ProfilePatchSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(ProfileSerializer(updated).data, status=status.HTTP_200_OK)

    def get_throttles(self):
        # Hanya penghapusan akun yang dibatasi; membaca/mengubah profil bebas.
        return [PerUserScopedThrottle()] if self.request.method == "DELETE" else []

    throttle_scope = "account_delete"

    def delete(self, request):
        """Hapus akun dan seluruh datanya (hak penghapusan UU PDP). Tidak bisa dibatalkan."""
        profile = get_request_profile(request)
        serializer = AccountDeleteSerializer(data=request.data, context={"profile": profile})
        serializer.is_valid(raise_exception=True)
        delete_account(profile)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeletionImpactView(APIView):
    """GET apa saja yang ikut hilang bila akun ini dihapus."""

    def get(self, request):
        return Response(deletion_impact(get_request_profile(request)))


class ConsentView(APIView):
    """Persetujuan pemrosesan data pribadi milik pemanggil.

    GET: keadaan yang berlaku beserta riwayatnya.
    POST: menyetujui ulang versi kebijakan yang berlaku (akun lama, versi baru,
    atau setelah ditarik). Pendaftaran baru mencatat persetujuan sendiri di
    RegisterView. Token baru dikembalikan karena klaim di token lama usang.
    """

    def get(self, request):
        profile = get_request_profile(request)
        return Response(consent_status(profile.id))

    def post(self, request):
        profile = get_request_profile(request)
        serializer = ConsentGiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Idempoten: klik ganda atau tab basi tidak boleh menambah baris GIVEN
        # dan menggeser tanggal bukti persetujuan yang sudah berlaku.
        if current_consent(profile.id) is not None:
            return Response(
                {"token": create_access_token(profile, request.user.sid), "consent": consent_status(profile.id)}
            )
        record_consent(
            profile.id,
            ConsentAction.GIVEN,
            items_for(profile.role),
            source=SOURCE_REACCEPT,
        )
        return Response(
            {"token": create_access_token(profile, request.user.sid), "consent": consent_status(profile.id)},
            status=status.HTTP_201_CREATED,
        )


class ConsentWithdrawView(APIView):
    """POST menarik persetujuan (Pasal 9 UU PDP).

    Berlaku seketika untuk pemrosesan baru: pengumpulan jawaban dan analisis
    ulang memeriksa basis data, bukan klaim token. Pasal 40 memberi batas
    paling lambat 3 x 24 jam; di sini tidak ada jeda sama sekali.
    """

    def post(self, request):
        profile = get_request_profile(request)
        if current_consent(profile.id) is not None:
            record_consent(
                profile.id, ConsentAction.WITHDRAWN, [], source=SOURCE_WITHDRAW
            )
        return Response(
            {"token": create_access_token(profile, request.user.sid), "consent": consent_status(profile.id)}
        )


class LogoutView(APIView):
    """POST akhiri sesi ini di server. Token yang sama langsung tidak berlaku lagi."""

    def post(self, request):
        revoke_session(request.user.sid)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UploadTicketView(APIView):
    """POST tiket pendek untuk mengunggah/mengambil berkas langsung ke API.

    Fungsi Vercel membatasi badan permintaan 4,5 MB, sedangkan dokumen bisa 10 MB
    dan audio 5 MB. Tiket hanya diterima endpoint yang menyatakan
    `accepts_upload_ticket`, dan tiket tidak bisa meminta tiket lagi.
    """

    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "upload_ticket"

    def post(self, request):
        if request.user.token_type != "access":
            raise AuthenticationFailed("Tiket unggah tidak bisa meminta tiket baru.")
        profile = get_request_profile(request)
        return Response(
            {
                "ticket": create_upload_ticket(profile, request.user.sid),
                "expires_in": settings.UPLOAD_TICKET_SECONDS,
            }
        )


class PasswordChangeView(APIView):
    """POST ganti kata sandi. Sesi lain dicabut; sesi ini tetap berlaku."""

    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "password_change"

    def post(self, request):
        profile = get_request_profile(request)
        serializer = PasswordChangeSerializer(data=request.data, context={"profile": profile})
        serializer.is_valid(raise_exception=True)
        profile.set_password(serializer.validated_data["new_password"])
        profile.save(update_fields=["password"])
        revoke_other_sessions(profile.id, request.user.sid)
        return Response({"detail": "Kata sandi diganti. Perangkat lain perlu masuk ulang."})
