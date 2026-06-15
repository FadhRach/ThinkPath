"""Seed demo data tahap 1.

Idempotent: pakai uuid5 dengan namespace tetap supaya re-run tidak membuat
duplikat. Aman dijalankan ulang kapan saja.
"""
from __future__ import annotations

import random
import uuid
from datetime import timedelta
from typing import Sequence

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from academics.join_codes import generate_unique_join_code
from academics.models import (
    AiBand,
    AnalysisResult,
    Assignment,
    Class,
    EventType,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
)
from core.models import EducationLevel, Profile, Role


SEED_NAMESPACE = uuid.UUID("8c5ff61a-94e0-4f3a-9d4e-4ad27d2e8d3c")
TEACHER_EMAIL = "teacher.demo@thinkpath.local"
TEACHER_NAME = "Bu Ningsih"


def _stable_uuid(label: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, label)


def _ensure_teacher() -> Profile:
    teacher, _ = Profile.objects.update_or_create(
        id=_stable_uuid("teacher:demo"),
        defaults={
            "email": TEACHER_EMAIL,
            "display_name": TEACHER_NAME,
            "role": Role.TEACHER,
            "education_level": "",
        },
    )
    return teacher


def _ensure_students(count: int) -> list[Profile]:
    students: list[Profile] = []
    for i in range(1, count + 1):
        label = f"student:{i:02d}"
        student, _ = Profile.objects.update_or_create(
            id=_stable_uuid(label),
            defaults={
                "email": f"siswa{i:02d}@thinkpath.local",
                "display_name": f"Siswa {i:02d}",
                "role": Role.STUDENT,
            },
        )
        students.append(student)
    return students


def _ensure_class(owner: Profile, label: str, name: str, subject: str, level: str) -> Class:
    class_id = _stable_uuid(f"class:{label}")
    existing = Class.objects.filter(pk=class_id).first()
    if existing is not None:
        existing.owner = owner
        existing.name = name
        existing.subject = subject
        existing.education_level = level
        existing.save()
        return existing
    return Class.objects.create(
        id=class_id,
        owner=owner,
        name=name,
        subject=subject,
        education_level=level,
        join_code=generate_unique_join_code(),
    )


def _ensure_assignment(
    target_class: Class,
    label: str,
    title: str,
    instructions: str,
    expected_bloom_level: int,
    education_level: str,
    deadline_days: int,
) -> Assignment:
    assignment_id = _stable_uuid(f"assignment:{label}")
    deadline = timezone.now() + timedelta(days=deadline_days)
    assignment, _ = Assignment.objects.update_or_create(
        id=assignment_id,
        defaults={
            "class_ref": target_class,
            "title": title,
            "instructions": instructions,
            "deadline": deadline,
            "expected_bloom_level": expected_bloom_level,
            "education_level": education_level,
        },
    )
    return assignment


# Profil submission menentukan distribusi durasi, revisi, paste, band.
_PROFILES = (
    ("natural", 4, (20 * 60, 45 * 60), (2, 6), False, AiBand.LOW, (5, 30)),
    ("ambiguous", 2, (8 * 60, 15 * 60), (1, 2), True, AiBand.MID, (35, 65)),
    ("review", 2, (2 * 60, 5 * 60), (0, 1), True, AiBand.HIGH, (70, 92)),
)


def _band_to_bloom(band: str, expected: int) -> int:
    if band == AiBand.LOW:
        return min(6, expected)
    if band == AiBand.MID:
        return max(1, expected - 1)
    return max(1, expected - 2)


def _build_signals(band: str) -> dict:
    if band == AiBand.LOW:
        return {"perplexity": 38.6, "burstiness": 0.62, "style_deviation": 0.09}
    if band == AiBand.MID:
        return {"perplexity": 24.1, "burstiness": 0.38, "style_deviation": 0.22}
    return {"perplexity": 14.2, "burstiness": 0.18, "style_deviation": 0.41}


def _build_recommendation(band: str) -> str:
    if band == AiBand.LOW:
        return "Tidak ada indikasi yang perlu ditindaklanjuti. Lanjutkan penilaian seperti biasa."
    if band == AiBand.MID:
        return "Beberapa sinyal bercampur. Disarankan tanya jawab singkat 5-10 menit untuk verifikasi."
    return "Disarankan diskusi 10-15 menit dengan siswa untuk memverifikasi pemahaman."


def _build_reasoning_events(
    submission: Submission,
    started_at,
    submitted_at,
    revision_count: int,
    has_large_paste: bool,
) -> list[ReasoningEvent]:
    events: list[ReasoningEvent] = [
        ReasoningEvent(
            id=_stable_uuid(f"event:{submission.id}:started"),
            submission=submission,
            event_type=EventType.STARTED,
            payload={},
            occurred_at=started_at,
        )
    ]
    if has_large_paste:
        paste_time = started_at + (submitted_at - started_at) * 0.3
        events.append(
            ReasoningEvent(
                id=_stable_uuid(f"event:{submission.id}:paste"),
                submission=submission,
                event_type=EventType.PASTE,
                payload={"char_count": random.randint(220, 520)},
                occurred_at=paste_time,
            )
        )
    for i in range(revision_count):
        offset = (submitted_at - started_at) * (0.4 + i * 0.1)
        events.append(
            ReasoningEvent(
                id=_stable_uuid(f"event:{submission.id}:rev:{i}"),
                submission=submission,
                event_type=EventType.REVISION,
                payload={"diff_chars": random.randint(40, 180)},
                occurred_at=started_at + offset,
            )
        )
    events.append(
        ReasoningEvent(
            id=_stable_uuid(f"event:{submission.id}:submitted"),
            submission=submission,
            event_type=EventType.SUBMITTED,
            payload={},
            occurred_at=submitted_at,
        )
    )
    return events


def _seed_submissions_for_assignment(
    rng: random.Random,
    assignment: Assignment,
    students: Sequence[Profile],
) -> int:
    """Buat submission dengan distribusi profil yang ditetapkan.

    Return jumlah submission yang berhasil di-upsert.
    """
    if len(students) < 8:
        raise RuntimeError("Butuh setidaknya 8 student profile untuk seed assignment.")

    created = 0
    student_iter = iter(students[:8])
    sample_answers = _sample_answers_for(assignment)

    for profile_name, count, duration_range, revision_range, has_paste, band, ai_score_range in _PROFILES:
        for index in range(count):
            student = next(student_iter)
            duration_seconds = rng.randint(*duration_range)
            revision_count = rng.randint(*revision_range)
            hours_ago = rng.randint(1, 48)
            submitted_at = timezone.now() - timedelta(hours=hours_ago)
            started_at = submitted_at - timedelta(seconds=duration_seconds)

            label = f"submission:{assignment.id}:{profile_name}:{index}"
            submission_id = _stable_uuid(label)

            submission, _ = Submission.objects.update_or_create(
                id=submission_id,
                defaults={
                    "assignment": assignment,
                    "student_profile": student,
                    "text_answer": sample_answers[band][index % len(sample_answers[band])],
                    "started_at": started_at,
                    "submitted_at": submitted_at,
                    "duration_seconds": duration_seconds,
                    "revision_count": revision_count,
                    "status": SubmissionStatus.SUBMITTED,
                },
            )

            ReasoningEvent.objects.filter(submission=submission).delete()
            ReasoningEvent.objects.bulk_create(
                _build_reasoning_events(
                    submission=submission,
                    started_at=started_at,
                    submitted_at=submitted_at,
                    revision_count=revision_count,
                    has_large_paste=has_paste,
                )
            )

            ai_score = rng.randint(*ai_score_range)
            AnalysisResult.objects.update_or_create(
                submission=submission,
                defaults={
                    "ai_score": ai_score,
                    "ai_band": band,
                    "bloom_level": _band_to_bloom(band, assignment.expected_bloom_level),
                    "signals": _build_signals(band),
                    "recommendation": _build_recommendation(band),
                },
            )
            created += 1
    return created


def _sample_answers_for(assignment: Assignment) -> dict[str, list[str]]:
    """Kumpulan jawaban contoh per band agar UI terlihat hidup."""
    base = assignment.title.lower()
    return {
        AiBand.LOW: [
            (
                "Menurut pemahaman saya, " + base + " adalah proses yang melibatkan beberapa "
                "tahap. Pertama, saya mengamati contoh di sekitar. Kemudian saya mencoba menjelaskan "
                "dengan kata-kata sendiri meski belum sempurna."
            ),
            (
                "Saya mencoba menjelaskan " + base + " berdasarkan diskusi di kelas. Awalnya saya "
                "kira hanya satu langkah, ternyata ada beberapa bagian yang saling berhubungan."
            ),
        ],
        AiBand.MID: [
            (
                base.capitalize() + " merupakan rangkaian proses yang dapat dijelaskan dalam "
                "beberapa tahap utama. Tahap pertama berkaitan dengan input, lalu pengolahan, dan "
                "akhirnya hasil yang dapat diamati."
            ),
            (
                "Berdasarkan literatur, " + base + " mencakup beberapa komponen kunci. Komponen "
                "tersebut saling mempengaruhi sehingga membentuk satu kesatuan yang utuh."
            ),
        ],
        AiBand.HIGH: [
            (
                base.capitalize() + " adalah suatu proses kompleks yang melibatkan interaksi "
                "berbagai variabel secara simultan. Dalam konteks ini, setiap variabel memiliki "
                "peran spesifik yang berkontribusi pada hasil akhir secara holistik dan terintegrasi."
            ),
            (
                "Secara fundamental, " + base + " dapat dikonseptualisasikan sebagai sistem yang "
                "saling terhubung. Pendekatan analitis menunjukkan bahwa terdapat korelasi signifikan "
                "antara komponen-komponen yang membentuknya."
            ),
        ],
    }


class Command(BaseCommand):
    help = "Seed data demo untuk mockup tahap 1 (idempotent)."

    def handle(self, *args, **options):
        rng = random.Random(42)

        with transaction.atomic():
            teacher = _ensure_teacher()
            students = _ensure_students(8)

            class_smp = _ensure_class(
                owner=teacher,
                label="ipa-7a",
                name="IPA 7A",
                subject="IPA",
                level=EducationLevel.SMP,
            )
            class_sma = _ensure_class(
                owner=teacher,
                label="sejarah-11ips",
                name="Sejarah 11 IPS",
                subject="Sejarah",
                level=EducationLevel.SMA_SMK,
            )

            assignments = [
                _ensure_assignment(
                    target_class=class_smp,
                    label="fotosintesis",
                    title="Fotosintesis: jelaskan prosesnya",
                    instructions="Tulis penjelasan singkat tentang tahapan fotosintesis dengan kata-kata sendiri.",
                    expected_bloom_level=3,
                    education_level=EducationLevel.SMP,
                    deadline_days=5,
                ),
                _ensure_assignment(
                    target_class=class_sma,
                    label="kolonialisme",
                    title="Reaksi terhadap kolonialisme di Asia Tenggara",
                    instructions="Bandingkan reaksi tiga negara terhadap kolonialisme Eropa pada abad ke-19.",
                    expected_bloom_level=4,
                    education_level=EducationLevel.SMA_SMK,
                    deadline_days=7,
                ),
                _ensure_assignment(
                    target_class=class_smp,
                    label="sel",
                    title="Bandingkan sel hewan dan tumbuhan",
                    instructions="Buat tabel perbandingan sel hewan dan tumbuhan, lalu tuliskan kesimpulan singkat.",
                    expected_bloom_level=4,
                    education_level=EducationLevel.SMP,
                    deadline_days=10,
                ),
            ]

            total_submissions = 0
            for assignment in assignments:
                total_submissions += _seed_submissions_for_assignment(
                    rng=rng,
                    assignment=assignment,
                    students=students,
                )

        self.stdout.write(
            "Seeded teacher={teacher_id}, classes=2, assignments={assignments}, submissions={submissions}, analysis_results={submissions}".format(
                teacher_id=teacher.id,
                assignments=len(assignments),
                submissions=total_submissions,
            )
        )
