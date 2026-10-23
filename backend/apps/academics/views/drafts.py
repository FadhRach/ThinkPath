"""Penyimpanan otomatis draf jawaban; sumber bukti proses yang dicatat server."""
from __future__ import annotations

from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Submission
from apps.academics.selectors import require_member_assignment
from apps.academics.serializers import DraftSaveSerializer
from apps.academics.services.drafts import save_draft
from apps.academics.services.submissions import reject_if_past_deadline, require_student_consent
from apps.accounts.permissions import IsStudent
from apps.accounts.services import get_request_profile
from common.throttling import PerUserScopedThrottle


class DraftView(APIView):
    """PUT simpan teks draf. Pengerjaan baru dicatat mulai simpan pertama yang berisi teks."""

    permission_classes = [IsStudent]
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "draft_save"

    def put(self, request, assignment_id: str):
        assignment = require_member_assignment(request, assignment_id)
        reject_if_past_deadline(assignment)
        student = get_request_profile(request)
        require_student_consent(
            student.id,
            "Setujui Kebijakan Privasi versi terbaru sebelum menulis jawaban. "
            "Muat ulang halaman untuk menyetujuinya.",
        )
        if Submission.objects.filter(assignment=assignment, student_profile=student).exists():
            # Revisi memakai jalur kumpul ulang; draf hanya untuk jawaban pertama.
            raise ValidationError("Jawaban sudah dikumpulkan. Gunakan Simpan Revisi.")
        serializer = DraftSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        draft = save_draft(
            assignment,
            student,
            serializer.validated_data["text_answer"],
            document_id=serializer.validated_data.get("document_id"),
        )
        return Response(
            {"started": draft is not None, "saved_at": draft.last_saved_at if draft else None}
        )
