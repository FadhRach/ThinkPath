"""Permission helpers reusable.

Semua cek kepemilikan kelas mengarah ke satu fungsi `is_class_owned_by`
agar tidak ada duplikasi logika di tiap permission class.
"""
from __future__ import annotations

from uuid import UUID

from rest_framework.permissions import BasePermission


def _coerce_uuid(value: object) -> UUID | None:
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except ValueError:
            return None
    return None


def is_class_owned_by(user_sub: str, class_id: object) -> bool:
    from academics.models import Class

    class_uuid = _coerce_uuid(class_id)
    if class_uuid is None:
        return False
    owner_uuid = _coerce_uuid(user_sub)
    if owner_uuid is None:
        return False
    return Class.objects.filter(id=class_uuid, owner_id=owner_uuid).exists()


class IsClassOwner(BasePermission):
    """Cek pemilik kelas berdasarkan parameter URL `class_id`."""

    def has_permission(self, request, view) -> bool:
        class_id = view.kwargs.get("class_id")
        return is_class_owned_by(request.user.sub, class_id)


class IsAssignmentOwner(BasePermission):
    """Cek pemilik kelas dari assignment berdasarkan parameter URL `assignment_id`."""

    def has_permission(self, request, view) -> bool:
        from academics.models import Assignment

        assignment_id = _coerce_uuid(view.kwargs.get("assignment_id"))
        if assignment_id is None:
            return False
        assignment = Assignment.objects.filter(id=assignment_id).only("class_ref_id").first()
        if assignment is None:
            return False
        return is_class_owned_by(request.user.sub, assignment.class_ref_id)


class IsSubmissionOwner(BasePermission):
    """Cek pemilik kelas dari submission berdasarkan parameter URL `submission_id`."""

    def has_permission(self, request, view) -> bool:
        from academics.models import Submission

        submission_id = _coerce_uuid(view.kwargs.get("submission_id"))
        if submission_id is None:
            return False
        submission = (
            Submission.objects.filter(id=submission_id)
            .select_related("assignment")
            .only("assignment__class_ref_id")
            .first()
        )
        if submission is None:
            return False
        return is_class_owned_by(request.user.sub, submission.assignment.class_ref_id)
