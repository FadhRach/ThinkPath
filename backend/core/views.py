from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import create_access_token
from .models import ConsentAction, Role
from .privacy import (
    ITEM_EXTERNAL_AI,
    consent_status,
    current_consent,
    record_consent,
)
from .serializers import (
    ConsentGiveSerializer,
    ConsentUpdateSerializer,
    LoginSerializer,
    ProfilePatchSerializer,
    ProfileSerializer,
    RegisterSerializer,
)
from .services import (
    authenticate_credentials,
    get_request_profile,
    register_profile,
)


class HealthView(APIView):
    """Endpoint cek hidup untuk keep-alive HF Spaces."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


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
        profile = register_profile(**serializer.validated_data)
        return Response(_auth_response(profile), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST login email + password, mengembalikan token dan profil."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "auth_login"

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


class ConsentView(APIView):
    """Persetujuan pemrosesan data pribadi milik pemanggil.

    GET: keadaan yang berlaku beserta riwayatnya.
    POST: memberi persetujuan untuk versi kebijakan yang berlaku. Token baru
    dikembalikan karena klaim persetujuan di token lama sudah usang.
    PATCH: mengubah pilihan opsional (mahasiswa: analisis di luar negeri).
    """

    def get(self, request):
        profile = get_request_profile(request)
        return Response(consent_status(profile.id))

    def post(self, request):
        profile = get_request_profile(request)
        serializer = ConsentGiveSerializer(
            data=request.data, context={"role": profile.role}
        )
        serializer.is_valid(raise_exception=True)
        record_consent(profile.id, ConsentAction.GIVEN, serializer.validated_data["items"])
        return Response(
            {"token": create_access_token(profile), "consent": consent_status(profile.id)},
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request):
        profile = get_request_profile(request)
        if profile.role != Role.STUDENT:
            raise ValidationError("Tidak ada pilihan opsional untuk peran ini.")
        current = current_consent(profile.id)
        if current is None:
            raise ValidationError("Setujui Kebijakan Privasi versi terbaru lebih dulu.")
        serializer = ConsentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = set(current.items) - {ITEM_EXTERNAL_AI}
        if serializer.validated_data["external_ai"]:
            items.add(ITEM_EXTERNAL_AI)
        if items != set(current.items):
            record_consent(profile.id, ConsentAction.UPDATED, items)
        return Response({"consent": consent_status(profile.id)})


class ConsentWithdrawView(APIView):
    """POST menarik persetujuan (Pasal 9 UU PDP).

    Berlaku seketika untuk pemrosesan baru: pengumpulan jawaban dan analisis
    ulang memeriksa basis data, bukan klaim token. Pasal 40 memberi batas
    paling lambat 3 x 24 jam; di sini tidak ada jeda sama sekali.
    """

    def post(self, request):
        profile = get_request_profile(request)
        if current_consent(profile.id) is not None:
            record_consent(profile.id, ConsentAction.WITHDRAWN, [])
        return Response(
            {"token": create_access_token(profile), "consent": consent_status(profile.id)}
        )
