"""Unggah dokumen jawaban (mahasiswa): PDF, DOCX, atau gambar menjadi teks."""
from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.selectors import require_member_assignment
from apps.academics.services import documents
from apps.academics.services.submissions import reject_if_past_deadline, require_student_consent
from apps.accounts.permissions import IsStudent
from apps.accounts.services import get_request_profile
from common.throttling import PerUserScopedThrottle


class DocumentImportView(APIView):
    """POST multipart `file`; membalas teks hasil ekstraksi untuk ditinjau di editor.

    Tidak membuat Submission: mahasiswa meninjau teksnya dulu, lalu
    mengumpulkan lewat endpoint submission dengan `document_id` dari balasan ini.
    """

    permission_classes = [IsStudent]
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "document_import"

    def post(self, request, assignment_id: str):
        assignment = require_member_assignment(request, assignment_id)
        if not assignment.allow_file_upload:
            raise PermissionDenied("Dosen tidak mengizinkan unggah berkas untuk tugas ini. Ketik jawabanmu langsung.")
        reject_if_past_deadline(assignment)
        student = get_request_profile(request)
        allow_external = require_student_consent(
            student.id,
            "Setujui Kebijakan Privasi versi terbaru sebelum mengunggah dokumen. "
            "Buka menu Pengaturan atau muat ulang halaman.",
        )
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Pilih berkas yang akan diunggah."})

        document_id, result = documents.import_document(
            upload, student.id, allow_external=allow_external
        )
        return Response(
            {
                "document_id": str(document_id),
                "text": result.text,
                "page_count": result.page_count,
                "method": result.method,
                "warnings": result.warnings,
            },
            status=status.HTTP_201_CREATED,
        )
