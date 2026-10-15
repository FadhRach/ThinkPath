"""Permission role-check reusable.

Kepemilikan objek (kelas/tugas/submission) diverifikasi di dalam view lewat
satu query `select_related`, bukan di sini. Ini menghindari fetch ganda
(permission mem-fetch objek, lalu view mem-fetch objek yang sama lagi) yang
menambah round-trip DB per request.
"""
from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsStudent(BasePermission):
    """Role student dari klaim token."""

    def has_permission(self, request, view) -> bool:
        return getattr(request.user, "role", None) == "student"


class IsTeacher(BasePermission):
    """Role teacher dari klaim token."""

    def has_permission(self, request, view) -> bool:
        return getattr(request.user, "role", None) == "teacher"
