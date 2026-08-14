"""Endpoint CRUD untuk kelas, tugas, membership, dan submission.

Kepemilikan objek diverifikasi sekali di helper `_require_*` (satu query
`select_related`, cek pemilik di memori) supaya tidak ada fetch ganda antara
permission dan view. List endpoints difilter ke pemilik (`user.sub`).
"""
from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStudent, IsTeacher
from core.services import get_profile_by_sub

from .join_codes import generate_unique_join_code
from .llm import run_analysis
from .cognitive import build_profile
from .overview import build_overview
from .process_signals import ProcessContext, ProgressSample
from .reports import build_report
from .models import (
    AiBand,
    AnalysisResult,
    Assignment,
    Class,
    ClassMembership,
    EventType,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
    VerbalVerification,
    VerificationStatus,
)
from .serializers import (
    AnalysisFullSerializer,
    AssignmentCreateSerializer,
    AssignmentListSerializer,
    ClassCreateSerializer,
    ClassListSerializer,
    ClassPublicSerializer,
    JoinClassSerializer,
    StudentAssignmentSerializer,
    StudentSubmissionStatusSerializer,
    SubmissionCreateSerializer,
    SubmissionDetailSerializer,
    SubmissionGradeSerializer,
    SubmissionListSerializer,
    TeacherAssignmentRowSerializer,
    VerificationQueueSerializer,
    VerificationSerializer,
    VerificationWriteSerializer,
)


def _owner_uuid(request) -> UUID:
    return UUID(request.user.sub)


def _get_request_profile(request):
    profile = get_profile_by_sub(request.user.sub)
    if profile is None:
        raise AuthenticationFailed("Akun tidak ditemukan.")
    return profile


def _parse_uuid_or_404(value: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError) as exc:
        raise NotFound() from exc


def _require_owned_class(request, class_id: str) -> Class:
    """Kelas milik dosen pemanggil. 404 bila tidak ada atau bukan miliknya."""
    target = Class.objects.filter(pk=_parse_uuid_or_404(class_id)).first()
    if target is None or target.owner_id != _owner_uuid(request):
        raise NotFound()
    return target


def _require_owned_assignment(request, assignment_id: str) -> Assignment:
    """Tugas di kelas milik dosen pemanggil (class_ref ikut di-load)."""
    assignment = (
        Assignment.objects.select_related("class_ref")
        .filter(pk=_parse_uuid_or_404(assignment_id))
        .first()
    )
    if assignment is None or assignment.class_ref.owner_id != _owner_uuid(request):
        raise NotFound()
    return assignment


def _require_member_assignment(request, assignment_id: str) -> Assignment:
    """Tugas di kelas yang diikuti mahasiswa pemanggil."""
    assignment = (
        Assignment.objects.select_related("class_ref")
        .filter(pk=_parse_uuid_or_404(assignment_id))
        .first()
    )
    if assignment is None:
        raise NotFound()
    is_member = ClassMembership.objects.filter(
        class_ref_id=assignment.class_ref_id,
        student_profile_id=_owner_uuid(request),
    ).exists()
    if not is_member:
        raise PermissionDenied("Kamu bukan anggota kelas ini.")
    return assignment


def _progress_samples(submission: Submission, started_at) -> tuple:
    """Baca cuplikan pertumbuhan kata yang tersimpan sebagai ReasoningEvent."""
    samples = []
    for event in submission.reasoning_events.all():
        if event.event_type != EventType.PROGRESS:
            continue
        count = (event.payload or {}).get("word_count")
        if not isinstance(count, int):
            continue
        offset = int((event.occurred_at - started_at).total_seconds())
        samples.append(ProgressSample(offset_seconds=max(0, offset), word_count=count))
    return tuple(sorted(samples, key=lambda s: s.offset_seconds))


def _build_process_context(
    text: str,
    duration_seconds: int | None,
    revision_count: int,
    paste_char_count: int = 0,
    progress: tuple = (),
) -> ProcessContext:
    """Rakit metadata pengerjaan untuk sinyal forensik E1.

    Sengaja tidak memuat jam dinding. Backend berjalan pada UTC sedangkan
    frontend merender waktu ke zona lokal pembaca, jadi jam ditampilkan di sisi
    frontend saja agar tidak ada dua jam berbeda di layar yang sama.
    """
    return ProcessContext(
        duration_seconds=duration_seconds,
        revision_count=revision_count,
        word_count=len(text.split()),
        char_count=len(text),
        progress=progress,
        paste_char_count=paste_char_count,
    )


def _paste_char_count(submission: Submission) -> int:
    total = 0
    for event in submission.reasoning_events.all():
        if event.event_type != EventType.PASTE:
            continue
        value = (event.payload or {}).get("char_count")
        if isinstance(value, int):
            total += value
    return total


def _assignment_annotations():
    return {
        "submission_count": Count("submissions", distinct=True),
        "high_band_count": Count(
            "submissions",
            filter=Q(submissions__analysis__ai_band=AiBand.HIGH),
            distinct=True,
        ),
        "needs_review_count": Count(
            "submissions",
            filter=Q(submissions__status=SubmissionStatus.SUBMITTED),
            distinct=True,
        ),
    }


class ReportOverviewView(APIView):
    """GET laporan agregat lintas kelas milik dosen pemanggil.

    Cakupan sengaja ditentukan di sini, bukan di reports.py. Saat peran Kaprodi
    dibangun nanti, cukup tambah view baru yang memberi queryset seluruh kelas
    satu prodi ke build_report(), tanpa menyentuh perhitungannya.
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        classes = Class.objects.filter(owner_id=_owner_uuid(request))
        return Response(build_report(classes))


class ClassListCreateView(APIView):
    """GET daftar kelas dosen; POST buat kelas baru."""

    permission_classes = [IsTeacher]

    def get(self, request):
        classes = (
            Class.objects.filter(owner_id=_owner_uuid(request))
            .annotate(assignment_count=Count("assignments"))
            .order_by("-created_at")
        )
        return Response(ClassListSerializer(classes, many=True).data)

    def post(self, request):
        owner_profile = _get_request_profile(request)
        serializer = ClassCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_class = Class.objects.create(
            owner=owner_profile,
            join_code=generate_unique_join_code(),
            **serializer.validated_data,
        )
        annotated = (
            Class.objects.filter(pk=new_class.pk)
            .annotate(assignment_count=Count("assignments"))
            .first()
        )
        return Response(
            ClassListSerializer(annotated).data,
            status=status.HTTP_201_CREATED,
        )


class AssignmentListCreateView(APIView):
    """GET assignment di kelas; POST buat assignment baru (dosen pemilik kelas)."""

    permission_classes = [IsTeacher]

    def get(self, request, class_id: str):
        target_class = _require_owned_class(request, class_id)
        assignments = (
            Assignment.objects.filter(class_ref=target_class)
            .select_related("class_ref")
            .annotate(**_assignment_annotations())
            .order_by("-created_at")
        )
        return Response(AssignmentListSerializer(assignments, many=True).data)

    def post(self, request, class_id: str):
        target_class = _require_owned_class(request, class_id)
        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_assignment = Assignment.objects.create(
            class_ref=target_class,
            **serializer.validated_data,
        )
        annotated = (
            Assignment.objects.filter(pk=new_assignment.pk)
            .select_related("class_ref")
            .annotate(**_assignment_annotations())
            .first()
        )
        return Response(
            AssignmentListSerializer(annotated).data,
            status=status.HTTP_201_CREATED,
        )


class TeacherOverviewView(APIView):
    """GET ringkasan agregat lintas kelas untuk layar depan dosen.

    Satu panggilan, bukan satu per grafik. Tiga visual di layar itu membaca
    kumpulan submission yang sama persis, dan memecahnya menjadi tiga endpoint
    hanya membuka peluang ketiganya menampilkan angka yang berbeda karena
    diambil pada saat yang berbeda.
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        owner_id = _owner_uuid(request)
        classes = Class.objects.filter(owner_id=owner_id).order_by("name")
        submissions = Submission.objects.filter(
            assignment__class_ref__owner_id=owner_id
        )
        return Response({"classes": build_overview(classes, submissions)})


class TeacherAssignmentListView(APIView):
    """GET seluruh tugas milik dosen, lintas kelas, terbaru di atas.

    Ada supaya halaman Daftar Tugas tidak perlu memanggil endpoint per kelas
    satu per satu. Anotasi hitungannya sama persis dengan daftar per kelas agar
    dua halaman tidak pernah menampilkan angka yang berbeda untuk tugas yang
    sama.
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        assignments = (
            Assignment.objects.filter(class_ref__owner_id=_owner_uuid(request))
            .select_related("class_ref")
            .annotate(**_assignment_annotations())
            .order_by("-deadline")
        )
        return Response(TeacherAssignmentRowSerializer(assignments, many=True).data)


class JoinClassView(APIView):
    """POST gabung kelas via join code (mahasiswa). Idempotent."""

    permission_classes = [IsStudent]

    def post(self, request):
        serializer = JoinClassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_class = Class.objects.filter(
            join_code=serializer.validated_data["join_code"]
        ).first()
        if target_class is None:
            raise NotFound("Kode kelas tidak ditemukan.")

        student_profile = _get_request_profile(request)
        _, created = ClassMembership.objects.get_or_create(
            class_ref=target_class,
            student_profile=student_profile,
        )
        return Response(
            {"class": ClassPublicSerializer(target_class).data, "created": created}
        )


def _latest_submission_map(student_id: UUID, assignment_ids: list) -> dict:
    """Map assignment_id -> submission terbaru milik mahasiswa."""
    submissions = Submission.objects.filter(
        student_profile_id=student_id,
        assignment_id__in=assignment_ids,
    ).order_by("assignment_id", "-created_at")
    latest: dict = {}
    for submission in submissions:
        if submission.assignment_id not in latest:
            latest[submission.assignment_id] = submission
    return latest


def _serialize_student_assignment(assignment: Assignment, submission) -> dict:
    data = StudentAssignmentSerializer(assignment).data
    data["submission"] = (
        StudentSubmissionStatusSerializer(submission).data
        if submission is not None
        else None
    )
    return data


class StudentClassListView(APIView):
    """GET daftar kelas yang diikuti mahasiswa beserta status tiap tugas."""

    permission_classes = [IsStudent]

    def get(self, request):
        student_id = _owner_uuid(request)
        memberships = (
            ClassMembership.objects.filter(student_profile_id=student_id)
            .select_related("class_ref__owner")
            .order_by("-joined_at")
        )
        class_ids = [membership.class_ref_id for membership in memberships]
        assignments = (
            Assignment.objects.filter(class_ref_id__in=class_ids)
            .select_related("class_ref")
            .order_by("-created_at")
        )
        latest = _latest_submission_map(
            student_id, [assignment.id for assignment in assignments]
        )

        assignments_by_class: dict = {}
        for assignment in assignments:
            assignments_by_class.setdefault(assignment.class_ref_id, []).append(
                _serialize_student_assignment(assignment, latest.get(assignment.id))
            )

        payload = []
        for membership in memberships:
            cls = membership.class_ref
            owner = cls.owner
            payload.append(
                {
                    "id": str(cls.id),
                    "name": cls.name,
                    "subject": cls.subject,
                    "education_level": cls.education_level,
                    "program_studi": cls.program_studi,
                    "semester": cls.semester,
                    "teacher_name": owner.display_name or owner.email,
                    "joined_at": membership.joined_at,
                    "assignments": assignments_by_class.get(cls.id, []),
                }
            )
        return Response(payload)


class StudentAssignmentDetailView(APIView):
    """GET detail satu tugas untuk mahasiswa anggota kelasnya."""

    permission_classes = [IsStudent]

    def get(self, request, assignment_id: str):
        assignment = _require_member_assignment(request, assignment_id)
        latest = _latest_submission_map(_owner_uuid(request), [assignment.id])
        return Response(
            {
                "class": ClassPublicSerializer(assignment.class_ref).data,
                "assignment": StudentAssignmentSerializer(assignment).data,
                "submission": (
                    StudentSubmissionStatusSerializer(latest[assignment.id]).data
                    if assignment.id in latest
                    else None
                ),
            }
        )


class SubmissionListView(APIView):
    """GET daftar submission (dosen pemilik). POST submit/revisi jawaban (mahasiswa)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [IsTeacher()]

    def get(self, request, assignment_id: str):
        assignment = _require_owned_assignment(request, assignment_id)
        submissions = (
            Submission.objects.filter(assignment=assignment)
            .select_related("student_profile", "analysis")
            .order_by("-submitted_at")
        )
        return Response(SubmissionListSerializer(submissions, many=True).data)

    def post(self, request, assignment_id: str):
        assignment = _require_member_assignment(request, assignment_id)
        self._reject_if_past_deadline(assignment)
        student_profile = _get_request_profile(request)

        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        text_answer = serializer.validated_data["text_answer"]

        latest = (
            Submission.objects.filter(
                assignment=assignment, student_profile=student_profile
            )
            .order_by("-created_at")
            .first()
        )
        if latest is not None and latest.status == SubmissionStatus.REVIEWED:
            raise ValidationError(
                "Jawaban sudah dinilai dosen dan tidak bisa direvisi."
            )

        if latest is not None:
            submission = self._revise_submission(latest, assignment, text_answer)
            detail = "Revisi jawaban berhasil disimpan."
        else:
            submission = self._create_submission(
                assignment, student_profile, text_answer, serializer.validated_data
            )
            detail = "Jawaban berhasil dikumpulkan."

        return Response(
            {"id": str(submission.id), "detail": detail},
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _reject_if_past_deadline(assignment: Assignment) -> None:
        if assignment.deadline and timezone.now() > assignment.deadline:
            raise ValidationError("Tenggat tugas sudah berakhir. Pengumpulan ditutup.")

    @staticmethod
    def _create_submission(assignment, student_profile, text_answer, validated) -> Submission:
        submitted_at = timezone.now()
        started_at = validated.get("started_at") or submitted_at
        if started_at > submitted_at:
            started_at = submitted_at
        duration_seconds = int((submitted_at - started_at).total_seconds())

        # Cuplikan di luar rentang mulai sampai kumpul dibuang. Klien yang
        # mengarang jejak tidak dipercaya begitu saja, dan cap waktu di luar
        # jendela pengerjaan pasti bukan hasil pengetikan yang nyata.
        samples = [
            s
            for s in validated.get("progress") or []
            if started_at <= s["at"] <= submitted_at
        ]
        progress = tuple(
            ProgressSample(
                offset_seconds=max(0, int((s["at"] - started_at).total_seconds())),
                word_count=s["word_count"],
            )
            for s in sorted(samples, key=lambda s: s["at"])
        )

        analysis = run_analysis(
            text_answer,
            assignment.class_ref.education_level,
            assignment.expected_bloom_level,
            _build_process_context(
                text_answer, duration_seconds, revision_count=0, progress=progress
            ),
        )
        with transaction.atomic():
            submission = Submission.objects.create(
                assignment=assignment,
                student_profile=student_profile,
                text_answer=text_answer,
                started_at=started_at,
                submitted_at=submitted_at,
                duration_seconds=duration_seconds,
                revision_count=0,
                status=SubmissionStatus.SUBMITTED,
            )
            ReasoningEvent.objects.bulk_create(
                [
                    ReasoningEvent(
                        submission=submission,
                        event_type=EventType.STARTED,
                        payload={},
                        occurred_at=started_at,
                    ),
                    ReasoningEvent(
                        submission=submission,
                        event_type=EventType.SUBMITTED,
                        payload={},
                        occurred_at=submitted_at,
                    ),
                ]
                + [
                    ReasoningEvent(
                        submission=submission,
                        event_type=EventType.PROGRESS,
                        payload={"word_count": sample.word_count},
                        occurred_at=started_at
                        + timedelta(seconds=sample.offset_seconds),
                    )
                    for sample in progress
                ]
            )
            AnalysisResult.objects.create(submission=submission, **analysis)
        return submission

    @staticmethod
    def _revise_submission(submission, assignment, text_answer) -> Submission:
        revised_at = timezone.now()
        # revision_count masih nilai lama di titik ini; revisi yang sedang
        # berjalan ikut dihitung supaya sinyal proses melihat angka yang sama
        # dengan yang nanti tersimpan.
        analysis = run_analysis(
            text_answer,
            assignment.class_ref.education_level,
            assignment.expected_bloom_level,
            _build_process_context(
                text_answer,
                submission.duration_seconds,
                submission.revision_count + 1,
                _paste_char_count(submission),
            ),
        )
        with transaction.atomic():
            submission.text_answer = text_answer
            submission.revision_count += 1
            submission.submitted_at = revised_at
            submission.status = SubmissionStatus.SUBMITTED
            submission.save(
                update_fields=[
                    "text_answer",
                    "revision_count",
                    "submitted_at",
                    "status",
                ]
            )
            ReasoningEvent.objects.create(
                submission=submission,
                event_type=EventType.REVISION,
                payload={"revision_count": submission.revision_count},
                occurred_at=revised_at,
            )
            AnalysisResult.objects.update_or_create(
                submission=submission, defaults=analysis
            )
        return submission


def _get_submission_or_404(submission_id: str) -> Submission:
    submission = (
        Submission.objects.select_related(
            "assignment__class_ref", "student_profile", "analysis"
        )
        .prefetch_related("reasoning_events")
        .filter(pk=_parse_uuid_or_404(submission_id))
        .first()
    )
    if submission is None:
        raise NotFound()
    return submission


def _require_owned_submission(request, submission_id: str) -> Submission:
    """Submission di kelas milik dosen pemanggil (cek pemilik di memori)."""
    submission = _get_submission_or_404(submission_id)
    if submission.assignment.class_ref.owner_id != _owner_uuid(request):
        raise NotFound()
    return submission


class StudentCognitiveProfileView(APIView):
    """GET profil kognitif satu mahasiswa, dilihat dosen pengampunya.

    Cakupan dibatasi ke kelas milik dosen pemanggil. Dosen tidak boleh melihat
    perkembangan mahasiswa di kelas dosen lain, meski mahasiswanya sama.
    """

    permission_classes = [IsTeacher]

    def get(self, request, student_id: str):
        student = get_profile_by_sub(str(_parse_uuid_or_404(student_id)))
        if student is None:
            raise NotFound()

        submissions = Submission.objects.filter(
            student_profile_id=student.id,
            assignment__class_ref__owner_id=_owner_uuid(request),
        )
        if not submissions.exists():
            raise NotFound()

        return Response(
            {
                "student": {
                    "id": str(student.id),
                    "display_name": student.display_name or student.email,
                },
                "classes": build_profile(submissions),
            }
        )


class StudentOwnProgressView(APIView):
    """GET perkembangan kognitif mahasiswa atas dirinya sendiri.

    Memakai perhitungan yang sama persis dengan tampilan dosen. Yang berbeda
    hanya cakupannya, dan skor AI tidak pernah ikut dikirim ke mahasiswa.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        submissions = Submission.objects.filter(
            student_profile_id=_owner_uuid(request)
        )
        classes = build_profile(submissions)
        # Skor AI sengaja dibuang di sini. Mahasiswa melihat perkembangan
        # berpikirnya, bukan dugaan sistem terhadap dirinya.
        for entry in classes:
            for point in entry["points"]:
                point.pop("ai_band", None)
        return Response({"classes": classes})


class SubmissionVerificationView(APIView):
    """PUT jadwalkan atau catat hasil verifikasi verbal satu submission.

    Satu endpoint untuk kedua hal karena keduanya menulis baris yang sama.
    Validasi urutannya ada di serializer: kesimpulan hanya boleh diisi setelah
    sesi berlangsung, bukan saat baru dijadwalkan.
    """

    permission_classes = [IsTeacher]

    def put(self, request, submission_id: str):
        submission = _require_owned_submission(request, submission_id)
        serializer = VerificationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        defaults = {
            "status": data["status"],
            "scheduled_at": data.get("scheduled_at"),
            "outcome": data.get("outcome") or "",
            "notes": data.get("notes", ""),
            "completed_at": (
                timezone.now()
                if data["status"] == VerificationStatus.COMPLETED
                else None
            ),
        }
        verification, _ = VerbalVerification.objects.update_or_create(
            submission=submission, defaults=defaults
        )
        return Response(VerificationSerializer(verification).data)

    def delete(self, request, submission_id: str):
        submission = _require_owned_submission(request, submission_id)
        VerbalVerification.objects.filter(submission=submission).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VerificationQueueView(APIView):
    """GET antrean verifikasi lintas kelas milik dosen pemanggil.

    Diurutkan supaya yang menuntut tindakan muncul lebih dulu: sesi terjadwal
    di atas, lalu yang sudah selesai sebagai riwayat.
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        queue = (
            VerbalVerification.objects.filter(
                submission__assignment__class_ref__owner_id=_owner_uuid(request)
            )
            .select_related(
                "submission__student_profile",
                "submission__assignment__class_ref",
                "submission__analysis",
            )
            .order_by("status", "scheduled_at")
        )
        return Response(VerificationQueueSerializer(queue, many=True).data)


class SubmissionDetailView(APIView):
    """GET detail submission; PATCH nilai + umpan balik dosen."""

    permission_classes = [IsTeacher]

    def get(self, request, submission_id: str):
        submission = _require_owned_submission(request, submission_id)
        return Response(SubmissionDetailSerializer(submission).data)

    def patch(self, request, submission_id: str):
        submission = _require_owned_submission(request, submission_id)
        serializer = SubmissionGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission.grade = serializer.validated_data["grade"]
        submission.teacher_feedback = serializer.validated_data["teacher_feedback"]
        submission.status = SubmissionStatus.REVIEWED
        submission.save(update_fields=["grade", "teacher_feedback", "status"])
        return Response(SubmissionDetailSerializer(submission).data)


class SubmissionReanalyzeView(APIView):
    """POST analisis ulang satu submission (dosen pemilik)."""

    permission_classes = [IsTeacher]

    def post(self, request, submission_id: str):
        submission = _require_owned_submission(request, submission_id)
        analysis = run_analysis(
            submission.text_answer,
            submission.assignment.class_ref.education_level,
            submission.assignment.expected_bloom_level,
            _build_process_context(
                submission.text_answer,
                submission.duration_seconds,
                submission.revision_count,
                _paste_char_count(submission),
            ),
        )
        result, _ = AnalysisResult.objects.update_or_create(
            submission=submission,
            defaults=analysis,
        )
        return Response({"analysis": AnalysisFullSerializer(result).data})
