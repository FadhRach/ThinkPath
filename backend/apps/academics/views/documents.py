"""Unggah dokumen jawaban (mahasiswa): PDF, DOCX, atau gambar menjadi teks."""
from __future__ import annotations

from django.http import FileResponse
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Submission
from apps.academics.selectors import require_member_assignment, require_owned_submission
from apps.academics.services import documents
from apps.academics.services.submissions import reject_if_past_deadline, require_student_consent
from apps.accounts.permissions import IsStudent
from apps.accounts.services import get_request_profile
from common.http import parse_uuid_or_404, request_user_id
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
            "Muat ulang halaman untuk menyetujuinya.",
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


def _file_response(found) -> FileResponse:
    handle, content_type = found
    response = FileResponse(handle, content_type=content_type)
    # Isi berkas dari mahasiswa: jangan biarkan peramban menebak jenisnya.
    response["X-Content-Type-Options"] = "nosniff"
    return response


class DocumentFileView(APIView):
    """GET berkas yang baru diunggah mahasiswa, untuk diperiksa sebelum dikumpulkan."""

    permission_classes = [IsStudent]

    def get(self, request, assignment_id: str, document_id: str):
        require_member_assignment(request, assignment_id)
        found = documents.open_original(request_user_id(request), parse_uuid_or_404(document_id))
        if found is None:
            raise NotFound()
        return _file_response(found)


class SubmissionDocumentView(APIView):
    """GET berkas asli sumber jawaban: dosen pemilik kelas atau mahasiswa penjawabnya."""

    def get(self, request, submission_id: str):
        if request.user.role == "teacher":
            submission = require_owned_submission(request, submission_id)
        else:
            submission = Submission.objects.filter(
                pk=parse_uuid_or_404(submission_id), student_profile_id=request_user_id(request)
            ).first()
            if submission is None:
                raise NotFound()
        found = (
            documents.open_original(submission.student_profile_id, submission.source_document)
            if submission.source_document
            else None
        )
        if found is None:
            raise NotFound("Jawaban ini tidak berasal dari berkas, atau berkasnya sudah tidak ada.")
        return _file_response(found)
