"""Agregat untuk dosen (overview, laporan, profil kognitif) dan progres mahasiswa."""
from __future__ import annotations

from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Class, ClassMembership, Submission
from apps.accounts.models import Profile
from apps.accounts.permissions import IsStudent, IsTeacher
from apps.analysis.insights.cognitive import build_profile
from apps.analysis.insights.overview import build_teacher_overview
from apps.analysis.insights.reports import build_report
from common.http import parse_uuid_or_404, request_user_id


class TeacherOverviewView(APIView):
    """GET ringkasan lintas kelas untuk layar depan dosen.

    Satu panggilan untuk tiga grafik: ketiganya membaca submission yang sama,
    jadi memecahnya membuka peluang angka yang berbeda antar grafik.
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        owner_id = request_user_id(request)
        classes = Class.objects.filter(owner_id=owner_id).order_by("name")
        submissions = Submission.objects.filter(assignment__class_ref__owner_id=owner_id)
        return Response({"classes": build_teacher_overview(classes, submissions)})


class ReportOverviewView(APIView):
    """GET laporan agregat per kelas, prodi, dan semester milik dosen.

    Cakupan ditentukan di sini, bukan di reports.py, supaya peran Kaprodi kelak
    cukup memberi queryset berbeda ke build_report().
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        return Response(build_report(Class.objects.filter(owner_id=request_user_id(request))))


class StudentCognitiveProfileView(APIView):
    """GET profil kognitif satu mahasiswa, hanya dari kelas milik dosen pemanggil."""

    permission_classes = [IsTeacher]

    def get(self, request, student_id: str):
        student = Profile.objects.filter(pk=parse_uuid_or_404(student_id)).first()
        if student is None:
            raise NotFound()
        owner_id = request_user_id(request)
        submissions = Submission.objects.filter(
            student_profile_id=student.id,
            assignment__class_ref__owner_id=owner_id,
        )
        if submissions.exists():
            classes = build_profile(submissions)
        elif ClassMembership.objects.filter(
            student_profile_id=student.id, class_ref__owner_id=owner_id
        ).exists():
            classes = []  # anggota baru yang belum mengumpulkan apa pun
        else:
            raise NotFound()
        return Response(
            {
                "student": {"id": str(student.id), "display_name": student.label},
                "classes": classes,
            }
        )


class StudentOwnProgressView(APIView):
    """GET perkembangan kognitif mahasiswa atas dirinya sendiri.

    Perhitungannya sama dengan tampilan dosen; bedanya hanya cakupan, dan
    band AI dibuang karena mahasiswa tidak pernah melihat dugaan sistem.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        classes = build_profile(
            Submission.objects.filter(student_profile_id=request_user_id(request))
        )
        for entry in classes:
            for point in entry["points"]:
                point.pop("ai_band", None)
        return Response({"classes": classes})
