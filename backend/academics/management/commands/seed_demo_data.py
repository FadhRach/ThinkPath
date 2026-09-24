"""Seed demo data tahap 1.

Idempotent: pakai uuid5 dengan namespace tetap supaya re-run tidak membuat
duplikat. Aman dijalankan ulang kapan saja.
"""
from __future__ import annotations

import random
import uuid
from datetime import timedelta
from typing import Sequence

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from academics.analysis import analyze_text
from academics.join_codes import generate_unique_join_code
from academics.process_signals import ProcessContext, ProgressSample
from academics.models import (
    AiBand,
    AnalysisResult,
    AnalysisSource,
    Assignment,
    Class,
    ClassMembership,
    EventType,
    Material,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
    VerbalVerification,
    VerificationOutcome,
    VerificationStatus,
)
from core.models import EducationLevel, Profile, Role
from notifications import events as notify_events
from notifications.models import Notification, NotificationKind


SEED_NAMESPACE = uuid.UUID("8c5ff61a-94e0-4f3a-9d4e-4ad27d2e8d3c")
TEACHER_EMAIL = "dosen@thinkpath.local"
TEACHER_NAME = "Dr. Ningsih Prameswari"
SEED_PASSWORD = "thinkpath123"


def _stable_uuid(label: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, label)


def _ensure_teacher() -> Profile:
    teacher, _ = Profile.objects.update_or_create(
        id=_stable_uuid("teacher:demo"),
        defaults={
            "email": TEACHER_EMAIL,
            "password": make_password(SEED_PASSWORD),
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
                "email": f"mhs{i:02d}@thinkpath.local",
                "password": make_password(SEED_PASSWORD),
                "display_name": f"Mahasiswa {i:02d}",
                "role": Role.STUDENT,
            },
        )
        students.append(student)
    return students


def _ensure_class(
    owner: Profile,
    label: str,
    name: str,
    subject: str,
    level: str,
    program_studi: str,
    semester: int,
) -> Class:
    class_id = _stable_uuid(f"class:{label}")
    existing = Class.objects.filter(pk=class_id).first()
    if existing is not None:
        existing.owner = owner
        existing.name = name
        existing.subject = subject
        existing.education_level = level
        existing.program_studi = program_studi
        existing.semester = semester
        existing.save()
        return existing
    return Class.objects.create(
        id=class_id,
        owner=owner,
        name=name,
        subject=subject,
        education_level=level,
        program_studi=program_studi,
        semester=semester,
        join_code=generate_unique_join_code(),
    )


def _ensure_assignment(
    target_class: Class,
    label: str,
    title: str,
    instructions: str,
    expected_bloom_level: int,
    deadline_days: int,
) -> Assignment:
    assignment_id = _stable_uuid(f"assignment:{label}")
    # Tenggat demo jatuh pukul 23.59 WIB (16.59 UTC) seperti kebiasaan dosen,
    # bukan pada menit seed kebetulan dijalankan. Tenggat yang dimaksudkan
    # sudah lewat (deadline_days <= 0) digeser sehari ke belakang bila jam
    # 23.59-nya belum tiba, supaya tugas lama tidak kembali terbuka hanya
    # karena seed dijalankan pagi hari.
    now = timezone.now()
    deadline = (now + timedelta(days=deadline_days)).replace(
        hour=16, minute=59, second=0, microsecond=0
    )
    if deadline_days <= 0 and deadline > now:
        deadline -= timedelta(days=1)
    assignment, _ = Assignment.objects.update_or_create(
        id=assignment_id,
        defaults={
            "class_ref": target_class,
            "title": title,
            "instructions": instructions,
            "deadline": deadline,
            "expected_bloom_level": expected_bloom_level,
        },
    )
    return assignment


# Profil per mahasiswa, tetap sepanjang semester.
#
# trajectory menentukan bagaimana kedalaman jawabannya berubah dari tugas ke
# tugas. Ini yang membuat grafik Profil Kognitif punya isi: tanpa lintasan,
# semua mahasiswa akan tampil sebagai garis datar dan layar itu tidak
# menunjukkan apa pun.
#
# band dan lintasan sengaja tidak berkorelasi. Ada mahasiswa berindikasi AI
# rendah yang tetap mandek di L1, dan ada yang berindikasi tinggi tetapi
# argumennya berkembang. Kombinasi itu yang membuktikan E1 dan E2 terpisah.
#
# Cara mengerjakan meniru rekaman form produksi, yaitu cuplikan jumlah kata
# tiap 30 detik, bukan angka karangan:
# - "tulis": kata bertambah sedikit demi sedikit tiap cuplikan.
# - "campur": sebagian besar diketik, dengan satu lompatan kecil (sekitar 30%
#   jawaban) seperti kutipan yang ditempel. Lompatannya di bawah ambang
#   lonjakan, jadi kutipan sewajar ini tidak terbaca sebagai apa pun.
# - "tempel": seluruh jawaban muncul sekaligus di awal lalu dikumpulkan.
#
# Revisi di sini berarti Simpan Revisi SETELAH dikumpulkan, sama seperti di
# produksi. Data demo lama mengarang revisi saat menulis dan tempelan acak,
# dua hal yang tidak pernah direkam aplikasinya sendiri.
_STUDENT_PROFILES = (
    # (band, lintasan, rentang durasi, cara mengerjakan, merevisi sekali)
    (AiBand.LOW, "naik", (20 * 60, 45 * 60), "tulis", False),
    (AiBand.LOW, "datar", (22 * 60, 48 * 60), "tulis", True),
    (AiBand.LOW, "naik", (25 * 60, 50 * 60), "tulis", False),
    (AiBand.LOW, "turun", (20 * 60, 40 * 60), "tulis", False),
    (AiBand.MID, "datar", (8 * 60, 15 * 60), "campur", False),
    (AiBand.MID, "naik", (9 * 60, 18 * 60), "campur", True),
    (AiBand.HIGH, "datar", (2 * 60, 5 * 60), "tempel", False),
    (AiBand.HIGH, "turun", (2 * 60, 6 * 60), "tempel", False),
)

# Selang cuplikan dan porsi lompatan persona "campur". Selang harus sama
# dengan form (30 detik) supaya kurva demo terbaca seperti rekaman asli.
SAMPLE_SECONDS = 30
MIXED_QUOTE_SHARE = 0.3


def _depth_for(trajectory: str, step: int, total: int) -> int:
    """Indeks jawaban contoh: 0 dangkal, 1 mendalam.

    Dipilih dari lintasan mahasiswa dan posisi tugas dalam rangkaian, bukan
    acak, supaya grafik trennya terbaca sebagai cerita: satu mahasiswa membaik,
    satu mandek, satu menurun.
    """
    if total <= 1:
        return 1 if trajectory == "turun" else 0
    progress = step / (total - 1)
    if trajectory == "naik":
        return 1 if progress >= 0.5 else 0
    if trajectory == "turun":
        return 0 if progress >= 0.5 else 1
    # datar: tetap di kedalaman yang sama sepanjang semester
    return 0


def _simulate_session(
    rng: random.Random, style: str, text: str, duration_seconds: int
) -> list[ProgressSample]:
    """Cuplikan jumlah kata untuk satu sesi mengerjakan."""
    final_words = len(text.split())
    offsets = list(range(0, duration_seconds, SAMPLE_SECONDS)) + [duration_seconds]

    if style == "tempel":
        # Teks penuh muncul di cuplikan kedua, lalu datar sampai dikumpulkan.
        samples = [
            ProgressSample(
                offset_seconds=offset,
                word_count=0 if offset == 0 else final_words,
            )
            for offset in offsets
        ]
        return samples

    quoted_words = round(final_words * MIXED_QUOTE_SHARE) if style == "campur" else 0
    typed_words = final_words - quoted_words
    # Lompatan persona campur jatuh di sepertiga sampai setengah sesi.
    quote_at = (
        offsets[max(1, round(len(offsets) * rng.uniform(0.33, 0.5)))]
        if quoted_words
        else None
    )

    samples = []
    for offset in offsets:
        progress = offset / duration_seconds if duration_seconds else 1.0
        words = round(typed_words * progress)
        if quote_at is not None and offset >= quote_at:
            words += quoted_words
        if 0 < offset < duration_seconds:
            # Menyunting sesekali menghapus beberapa kata, jadi kurvanya tidak
            # pernah lurus sempurna seperti hasil rumus.
            words = max(0, words - rng.choice((0, 0, 0, 1, 2)))
        if offset == duration_seconds:
            words = final_words
        samples.append(ProgressSample(offset_seconds=offset, word_count=max(words, 0)))
    return samples


def _build_reasoning_events(
    submission: Submission,
    started_at,
    first_submitted_at,
    revised_at,
    samples: list[ProgressSample],
) -> list[ReasoningEvent]:
    """Event dengan bentuk yang sama persis dengan yang ditulis views produksi."""
    events: list[ReasoningEvent] = [
        ReasoningEvent(
            id=_stable_uuid(f"event:{submission.id}:started"),
            submission=submission,
            event_type=EventType.STARTED,
            payload={},
            occurred_at=started_at,
        ),
        ReasoningEvent(
            id=_stable_uuid(f"event:{submission.id}:submitted"),
            submission=submission,
            event_type=EventType.SUBMITTED,
            payload={},
            occurred_at=first_submitted_at,
        ),
    ]
    events += [
        ReasoningEvent(
            id=_stable_uuid(f"event:{submission.id}:progress:{index}"),
            submission=submission,
            event_type=EventType.PROGRESS,
            payload={"word_count": sample.word_count},
            occurred_at=started_at + timedelta(seconds=sample.offset_seconds),
        )
        for index, sample in enumerate(samples)
    ]
    if revised_at is not None:
        events.append(
            ReasoningEvent(
                id=_stable_uuid(f"event:{submission.id}:revision:1"),
                submission=submission,
                event_type=EventType.REVISION,
                payload={"revision_count": 1},
                occurred_at=revised_at,
            )
        )
    return events


def _seed_submissions_for_assignment(
    rng: random.Random,
    assignment: Assignment,
    students: Sequence[Profile],
    step: int,
    total_steps: int,
    weeks_ago: int,
) -> int:
    """Buat satu submission per mahasiswa untuk satu tugas.

    step dan total_steps menentukan posisi tugas ini dalam rangkaian satu
    kelas, dipakai untuk memilih kedalaman jawaban sesuai lintasan mahasiswa.
    weeks_ago menempatkan submission di masa lalu supaya grafik tren punya
    sumbu waktu yang nyata.

    Return jumlah submission yang berhasil di-upsert.
    """
    if len(students) < 8:
        raise RuntimeError("Butuh setidaknya 8 profil mahasiswa untuk seed assignment.")

    created = 0
    expected_ids: list[uuid.UUID] = []
    sample_answers = _sample_answers_for(assignment)

    for index, (band, trajectory, duration_range, style, revises) in enumerate(
        _STUDENT_PROFILES
    ):
        student = students[index]
        duration_seconds = rng.randint(*duration_range)
        first_submitted_at = timezone.now() - timedelta(
            weeks=weeks_ago, hours=rng.randint(1, 40)
        )
        started_at = first_submitted_at - timedelta(seconds=duration_seconds)
        # Revisi terjadi beberapa jam setelah submit pertama, dan submitted_at
        # ikut maju ke waktu revisi, persis seperti jalur Simpan Revisi.
        revised_at = (
            first_submitted_at + timedelta(hours=rng.randint(2, 20)) if revises else None
        )
        submitted_at = revised_at or first_submitted_at
        revision_count = 1 if revises else 0

        label = f"submission:{assignment.id}:{index}"
        submission_id = _stable_uuid(label)
        expected_ids.append(submission_id)

        # Tugas lama sudah dinilai, yang terbaru belum. Itu keadaan yang wajar
        # di tengah semester dan membuat dashboard punya kedua status.
        is_graded = weeks_ago >= 3
        depth = _depth_for(trajectory, step, total_steps)
        submission, _ = Submission.objects.update_or_create(
            id=submission_id,
            defaults={
                "assignment": assignment,
                "student_profile": student,
                "text_answer": sample_answers[band][depth],
                "started_at": started_at,
                "submitted_at": submitted_at,
                "duration_seconds": duration_seconds,
                "revision_count": revision_count,
                "status": (
                    SubmissionStatus.REVIEWED
                    if is_graded
                    else SubmissionStatus.SUBMITTED
                ),
                "grade": rng.randint(78, 95) if is_graded else None,
                "teacher_feedback": (
                    "Argumenmu runtut dan memakai contoh dari praktikum sendiri. Pertahankan."
                    if is_graded
                    else ""
                ),
            },
        )

        samples = _simulate_session(rng, style, submission.text_answer, duration_seconds)
        ReasoningEvent.objects.filter(submission=submission).delete()
        ReasoningEvent.objects.bulk_create(
            _build_reasoning_events(
                submission=submission,
                started_at=started_at,
                first_submitted_at=first_submitted_at,
                revised_at=revised_at,
                samples=samples,
            )
        )

        # Tidak ada angka yang ditulis tangan. Seluruh baris demo dihitung
        # pipeline yang sama dengan jalur produksi, termasuk sinyal forensik
        # proses dari cuplikan di atas.
        analysis = analyze_text(
            submission.text_answer,
            assignment.expected_bloom_level,
            ProcessContext(
                duration_seconds=duration_seconds,
                revision_count=revision_count,
                word_count=len(submission.text_answer.split()),
                char_count=len(submission.text_answer),
                progress=tuple(samples),
            ),
        )
        analysis["analysis_source"] = AnalysisSource.SEED
        AnalysisResult.objects.update_or_create(
            submission=submission,
            defaults=analysis,
        )
        created += 1

    # Buang submission seed lama yang tidak lagi diharapkan.
    #
    # Tanpa ini, seed hanya idempoten selama pola ID-nya tidak berubah. Begitu
    # strukturnya diubah, baris lama tertinggal berdampingan dengan yang baru
    # dan grafik tren menampilkan titik hantu: pernah terlihat 7 titik untuk
    # rangkaian yang cuma berisi 5 tugas.
    Submission.objects.filter(assignment=assignment).exclude(
        id__in=expected_ids
    ).delete()
    return created


def _seed_verifications(
    students: Sequence[Profile], assignments: Sequence[Assignment]
) -> int:
    """Contoh sesi verifikasi verbal supaya layar Verifikasi tidak pernah kosong.

    Dipilih dari mahasiswa berpola tempel: dua sesi sudah selesai dengan
    kesimpulan yang berbeda, satu masih dijadwalkan. Kesimpulan "mampu
    menjelaskan" sengaja ada, karena skor tinggi tidak sama dengan menyontek.
    """
    if len(students) < 8:
        return 0

    def _has(assignment: Assignment, status: str) -> bool:
        return assignment.submissions.filter(status=status).exists()

    graded = [a for a in assignments if _has(a, SubmissionStatus.REVIEWED)]
    open_ones = [a for a in assignments if _has(a, SubmissionStatus.SUBMITTED)]

    plans = []
    if graded:
        plans += [
            (
                students[6],
                graded[-1],
                VerificationStatus.COMPLETED,
                VerificationOutcome.PARTIAL,
                "Bisa menjelaskan kerangka umum, tetapi belum bisa menguraikan "
                "contoh yang ia tulis sendiri.",
            ),
            (
                students[7],
                graded[0],
                VerificationStatus.COMPLETED,
                VerificationOutcome.CAN_EXPLAIN,
                "Menjelaskan alur argumen dengan runtut dan menjawab pertanyaan "
                "lanjutan tanpa melihat teks.",
            ),
        ]
    if open_ones:
        plans.append((students[6], open_ones[-1], VerificationStatus.SCHEDULED, "", ""))

    now = timezone.now()
    # Sesi yang masih dijadwalkan jatuh pukul 10.00 WIB (03.00 UTC) lusa.
    upcoming_slot = (now + timedelta(days=2)).replace(
        hour=3, minute=0, second=0, microsecond=0
    )
    count = 0
    for student, assignment, status_value, outcome, notes in plans:
        submission = Submission.objects.filter(
            assignment=assignment, student_profile=student
        ).first()
        if submission is None:
            continue
        completed = status_value == VerificationStatus.COMPLETED
        VerbalVerification.objects.update_or_create(
            submission=submission,
            defaults={
                "status": status_value,
                "scheduled_at": (submission.submitted_at + timedelta(days=2))
                if completed
                else upcoming_slot,
                "outcome": outcome,
                "notes": notes,
                "completed_at": (submission.submitted_at + timedelta(days=2))
                if completed
                else None,
            },
        )
        count += 1
    return count


# Materi demo: (label, topik, judul, ringkasan, tautan, berapa hari lalu
# dibagikan). Topik mengikuti pertemuan tempat tugasnya dibahas; topik kosong
# berarti materi umum. Setiap tautan sudah diperiksa bisa dibuka; materi tanpa
# tautan adalah catatan yang ditulis dosen sendiri.
_MATERIALS = {
    "metpen-a": [
        (
            "kontrak-kuliah",
            "",
            "Kontrak kuliah dan komponen nilai",
            "Komponen nilai: tugas mingguan 40%, UTS 25%, UAS 35%. Pengumpulan "
            "ditutup tepat pada tenggat, jadi kerjakan lebih awal.",
            "",
            84,
        ),
        (
            "metodologi",
            "",
            "Gambaran umum metodologi penelitian",
            "Bacaan pembuka sebelum memilih pendekatan penelitian.",
            "https://id.wikipedia.org/wiki/Metodologi_penelitian",
            63,
        ),
        (
            "rumusan-masalah",
            "Pertemuan 2: Merumuskan masalah",
            "Panduan menyusun rumusan masalah",
            "Rumusan masalah yang baik bisa dijawab dengan data, cukup sempit untuk "
            "satu skripsi, dan menyebut fenomena yang diteliti. Bawa satu draf "
            "rumusan ke pertemuan berikutnya untuk dibahas bersama.",
            "",
            70,
        ),
        (
            "kualitatif",
            "Pertemuan 6: Desain penelitian kualitatif",
            "Pengantar penelitian kualitatif",
            "Bacaan pendukung untuk tugas Desain penelitian kualitatif. Perhatikan "
            "bagian teknik pengumpulan data.",
            "https://id.wikipedia.org/wiki/Penelitian_kualitatif",
            45,
        ),
        (
            "studi-kasus",
            "Pertemuan 6: Desain penelitian kualitatif",
            "Studi kasus sebagai desain penelitian",
            "Salah satu desain yang bisa dipilih untuk tugas Desain penelitian "
            "kualitatif. Bandingkan dengan desain lain sebelum memutuskan.",
            "https://id.wikipedia.org/wiki/Studi_kasus",
            44,
        ),
        (
            "reliabilitas",
            "Pertemuan 8: Validitas dan reliabilitas",
            "Reliabilitas instrumen",
            "Baca sebelum mengerjakan tugas Validitas dan reliabilitas instrumen.",
            "https://id.wikipedia.org/wiki/Reliabilitas",
            31,
        ),
        (
            "kuantitatif",
            "Pertemuan 8: Validitas dan reliabilitas",
            "Pengukuran pada penelitian kuantitatif",
            "Validitas dan reliabilitas paling sering dibahas pada instrumen "
            "kuantitatif. Fokus pada bagian pengukuran.",
            "https://id.wikipedia.org/wiki/Penelitian_kuantitatif",
            30,
        ),
        (
            "etika",
            "Pertemuan 11: Etika penelitian",
            "Etika penelitian",
            "Bahan untuk tugas yang sedang berjalan: Etika penelitian dan persetujuan "
            "responden.",
            "https://id.wikipedia.org/wiki/Etika_penelitian",
            1,
        ),
    ],
    "ekbang-b": [
        (
            "kontrak-kuliah",
            "",
            "Kontrak kuliah dan komponen nilai",
            "Komponen nilai: tugas 40%, UTS 30%, UAS 30%. Ringkasan diskusi kelas "
            "dibagikan di halaman ini setiap pekan.",
            "",
            80,
        ),
        (
            "pembangunan-ekonomi",
            "Pertemuan 2: Konsep pembangunan",
            "Pertumbuhan dan pembangunan ekonomi",
            "Bacaan dasar: kenapa pertumbuhan ekonomi belum tentu berarti pembangunan.",
            "https://id.wikipedia.org/wiki/Pembangunan_ekonomi",
            66,
        ),
        (
            "ipm",
            "Pertemuan 4: Indikator pembangunan",
            "Indeks Pembangunan Manusia",
            "Salah satu indikator yang dibahas pada tugas Memilih indikator "
            "pembangunan.",
            "https://id.wikipedia.org/wiki/Indeks_Pembangunan_Manusia",
            52,
        ),
        (
            "pdrb",
            "Pertemuan 4: Indikator pembangunan",
            "PDRB sebagai ukuran ekonomi daerah",
            "Bandingkan dengan IPM: apa yang diukur, dan apa yang terlewat.",
            "https://id.wikipedia.org/wiki/Produk_domestik_regional_bruto",
            50,
        ),
        (
            "subsidi",
            "Pertemuan 6: Kebijakan subsidi",
            "Subsidi dan ketepatan sasaran",
            "Bacaan awal untuk tugas Efektivitas kebijakan subsidi energi.",
            "https://id.wikipedia.org/wiki/Subsidi",
            38,
        ),
        (
            "gini",
            "Pertemuan 9: Ketimpangan antarwilayah",
            "Koefisien Gini",
            "Ukuran ketimpangan yang paling sering dikutip. Perhatikan apa yang "
            "tidak ditangkapnya.",
            "https://id.wikipedia.org/wiki/Koefisien_Gini",
            16,
        ),
        (
            "ketimpangan",
            "Pertemuan 9: Ketimpangan antarwilayah",
            "Ringkasan diskusi: ketimpangan antarwilayah",
            "Tiga sebab yang muncul di kelas: investasi menumpuk di kota besar, "
            "infrastruktur yang timpang, dan kapasitas fiskal daerah yang berbeda. "
            "Gunakan salah satunya sebagai titik awal argumen.",
            "",
            2,
        ),
        (
            "desentralisasi",
            "Pertemuan 11: Desentralisasi fiskal",
            "Desentralisasi dan kewenangan daerah",
            "Bahan untuk tugas yang sedang berjalan: Ruang fiskal pemerintah daerah.",
            "https://id.wikipedia.org/wiki/Desentralisasi",
            3,
        ),
    ],
}


def _seed_materials(classes: dict[str, Class]) -> list[Material]:
    now = timezone.now()
    materials: list[Material] = []
    expected_ids: list[uuid.UUID] = []
    for class_label, items in _MATERIALS.items():
        target_class = classes[class_label]
        for label, topic, title, description, url, days_ago in items:
            material_id = _stable_uuid(f"material:{class_label}:{label}")
            expected_ids.append(material_id)
            material, _ = Material.objects.update_or_create(
                id=material_id,
                defaults={
                    "class_ref": target_class,
                    "topic": topic,
                    "title": title,
                    "description": description,
                    "url": url,
                },
            )
            # created_at diisi otomatis saat dibuat; tanggal demo disebar
            # supaya daftar materi punya urutan yang masuk akal.
            Material.objects.filter(pk=material.pk).update(
                created_at=now - timedelta(days=days_ago)
            )
            material.refresh_from_db()
            materials.append(material)
    Material.objects.filter(class_ref__in=classes.values()).exclude(
        id__in=expected_ids
    ).delete()
    return materials


def _seed_notifications(
    teacher: Profile,
    students: Sequence[Profile],
    assignments: Sequence[Assignment],
    materials: Sequence[Material],
) -> int:
    """Isi lonceng akun demo lewat fungsi peristiwa yang sama dengan produksi.

    Notifikasi lama milik akun demo dihapus dulu supaya seed tetap idempoten.
    Waktunya lalu disetel ke saat peristiwanya terjadi, dan yang sudah lama
    ditandai dibaca, supaya lonceng tidak menampilkan puluhan hal "baru saja".
    """
    now = timezone.now()
    profiles = [teacher, *students]
    Notification.objects.filter(recipient__in=profiles).delete()
    mine = Notification.objects.filter(recipient__in=profiles)

    # Dosen: pengumpulan tugas terakhir tiap kelas, digabung per tugas.
    latest_by_class: dict = {}
    for assignment in assignments:
        if assignment.deadline and assignment.deadline < now:
            current = latest_by_class.get(assignment.class_ref_id)
            if current is None or assignment.deadline > current.deadline:
                latest_by_class[assignment.class_ref_id] = assignment
    for assignment in latest_by_class.values():
        submissions = list(
            assignment.submissions.select_related(
                "student_profile", "assignment__class_ref"
            ).order_by("submitted_at")
        )
        for submission in submissions:
            notify_events.submission_received(submission, revised=False)
        if submissions:
            mine.filter(group_key=f"submissions:{assignment.id}").update(
                created_at=submissions[-1].submitted_at
            )

    # Mahasiswa: tugas yang masih berjalan dan materi terbaru tiap kelas.
    for assignment in assignments:
        if assignment.deadline and assignment.deadline > now:
            notify_events.assignment_created(assignment)
    mine.filter(kind=NotificationKind.ASSIGNMENT_NEW).update(
        created_at=now - timedelta(hours=5)
    )
    newest: dict = {}
    for material in materials:
        current = newest.get(material.class_ref_id)
        if current is None or material.created_at > current.created_at:
            newest[material.class_ref_id] = material
    for material in newest.values():
        notify_events.material_created(material)
        mine.filter(kind=NotificationKind.MATERIAL_NEW, title__endswith=material.title).update(
            created_at=material.created_at
        )

    # Nilai terbaru tiap mahasiswa, sudah lama dan sudah dibaca.
    for student in students:
        graded = (
            Submission.objects.filter(student_profile=student, status=SubmissionStatus.REVIEWED)
            .select_related("assignment")
            .order_by("-submitted_at")
            .first()
        )
        if graded is None:
            continue
        notify_events.submission_graded(graded)
        at = graded.submitted_at + timedelta(days=3)
        mine.filter(recipient=student, kind=NotificationKind.SUBMISSION_GRADED).update(
            created_at=at, read_at=at + timedelta(hours=2)
        )

    # Undangan sesi diskusi yang masih dijadwalkan.
    scheduled = VerbalVerification.objects.filter(
        status=VerificationStatus.SCHEDULED, submission__student_profile__in=students
    ).select_related("submission__assignment")
    for verification in scheduled:
        notify_events.session_changed(
            verification,
            submission=verification.submission,
            previous_status=None,
            previous_at=None,
        )
    mine.filter(kind=NotificationKind.SESSION_SCHEDULED).update(
        created_at=now - timedelta(hours=3)
    )
    return mine.count()


def _sample_answers_for(assignment: Assignment) -> dict[str, list[str]]:
    """Jawaban contoh yang memvariasikan dua dimensi secara terpisah.

    Tiap band punya satu varian kognitif lemah dan satu varian kognitif kuat.
    Tujuannya supaya dashboard demo memperlihatkan keempat kombinasi:
    indikasi AI rendah dengan penalaran kuat, indikasi AI rendah dengan
    penalaran lemah, indikasi AI tinggi dengan penalaran kuat, dan indikasi AI
    tinggi dengan penalaran lemah.

    Kombinasi silang itu adalah bukti paling langsung bahwa skor AI dan level
    Bloom sekarang benar benar diukur terpisah.
    """
    base = assignment.title.lower()
    return {
        # Ragam informal dan suara orang pertama menekan skor AI.
        # Suara manusia pada register akademik hadir lewat keraguan, kualifikasi,
        # dan rujukan konkret ke mata kuliah. Bukan lewat ragam informal, karena
        # mahasiswa yang menulis esai tidak memakainya.
        AiBand.LOW: [
            # Kognitif lemah: mendaftar ulang isi bacaan tanpa penalaran.
            (
                "Sejauh ini yang saya pahami dari materi " + base + " ada beberapa "
                "bagian. Pertama soal definisinya, lalu jenis jenisnya, kemudian "
                "pihak yang terlibat di dalamnya. Di slide mata kuliah kemarin "
                "disebutkan juga ada dampak lanjutannya. Harus diakui saya belum "
                "sepenuhnya paham bagian terakhir itu, jadi saya tuliskan kembali "
                "yang sempat saya catat. Belum jelas bagi saya bagaimana ketiganya "
                "berhubungan satu sama lain."
            ),
            # Kognitif kuat: sebab akibat, pembandingan, penilaian berdasar alasan.
            (
                "Saya mencoba menguraikan " + base + " berdasarkan bacaan mata "
                "kuliah dan diskusi kelas. Faktor awal menentukan hasil faktor "
                "berikutnya, sehingga urutannya tidak bisa dibalik begitu saja. "
                "Akibatnya pendekatan yang sama bisa menghasilkan efek berlawanan, "
                "tergantung bagaimana penerapannya dirancang. Waktu praktikum "
                "kemarin, kelompok saya sengaja melewati tahap pertama dan hasilnya "
                "justru menyimpang jauh, sesuatu yang tidak kami duga. Ini berbeda "
                "dengan asumsi awal saya bahwa tahapannya bisa dipertukarkan. "
                "Setidaknya pada percobaan itu, kualitas persiapan tampaknya lebih "
                "menentukan daripada urutannya sendiri. Menurut saya penjelasan di "
                "buku rujukan kurang tepat, karena menggambarkan seolah semuanya "
                "berjalan serentak. Sebaiknya digambarkan bertahap. Kelemahan "
                "analisis saya sendiri, datanya hanya dari satu percobaan, sehingga "
                "belum tentu berlaku untuk kasus lain. Masih perlu pembanding "
                "sebelum kesimpulan ini bisa dipegang. Kalau dibandingkan dengan "
                "studi kasus yang dibahas pada pertemuan sebelumnya, polanya juga "
                "tidak sepenuhnya sama, sedangkan kondisi awalnya mirip. Perbedaan "
                "itu membuat saya menduga ada faktor lain yang belum kami "
                "perhitungkan. Sejauh ini saya menilai kerangka yang dipakai di "
                "kelas masih lebih tepat daripada yang ada di buku rujukan, karena "
                "kerangka itu setidaknya mengakui adanya ketergantungan antartahap. "
                "Meski begitu saya belum sepenuhnya yakin, dan akan mencoba "
                "menguji ulang dengan data pembanding pada tugas berikutnya."
            ),
        ],
        # Campuran: sebagian baku dan berfrasa klise, sebagian masih menyisakan
        # suara penulisnya. Panjangnya sekitar 110 kata, dan skornya diukur
        # ulang setelah keragaman kosakata berhenti jenuh pada jawaban pendek
        # dan setelah tindakan menempel berhenti diskor: skornya kini datang
        # dari gaya teks saja, dengan jarak aman di atas ambang sedang 42.
        AiBand.MID: [
            # Kognitif menengah: menjelaskan ulang dan menguraikan langkah.
            (
                base.capitalize() + " merupakan rangkaian proses yang dapat "
                "dijelaskan dalam beberapa tahap. Artinya, ada urutan yang perlu "
                "diikuti supaya hasilnya sesuai dengan tujuan. Pertama, kondisi awal "
                "disiapkan terlebih dahulu dengan cermat. Kemudian kondisi tersebut "
                "diproses pada tahap berikutnya secara bertahap. Setelah itu "
                "hasilnya dapat diamati dan dicatat dengan teliti. Tahap pencatatan "
                "ini memainkan peran penting dalam keseluruhan proses. Caranya "
                "kurang lebih seperti yang dicontohkan pada modul praktikum. Saya "
                "menerapkan langkah yang sama ketika mengerjakan studi kasus "
                "sebelumnya. Setiap tahap memiliki tujuan yang jelas dan saling "
                "melengkapi satu sama lain. Dengan mengikuti urutan tersebut, hasil "
                "yang diperoleh menjadi lebih mudah diperiksa kembali. Secara "
                "fundamental, langkah tersebut dapat diterapkan pada berbagai situasi "
                "yang serupa."
            ),
            # Kognitif lebih kuat: sebab akibat dan pembandingan yang eksplisit.
            (
                "Berdasarkan bacaan, " + base + " mencakup beberapa komponen yang "
                "saling mempengaruhi. Komponen pertama menentukan hasil komponen "
                "kedua, sehingga urutannya penting. Namun apabila dibandingkan "
                "dengan kasus yang dibahas di kelas, ada perbedaan yang cukup jelas. "
                "Pada kasus di kelas faktor eksternal hampir tidak berpengaruh, "
                "sedangkan pada contoh di literatur faktor eksternal justru mengubah "
                "hasilnya. Perlu dicatat, perbedaan ini muncul karena kondisi awalnya "
                "memang tidak sama. Tidak dapat dipungkiri, kondisi awal memainkan peran penting "
                "terhadap arah hasil akhir. Kondisi yang stabil menghasilkan pola "
                "yang lebih mudah diprediksi. Sebaliknya, kondisi yang berubah ubah "
                "menghasilkan pola yang sulit dibandingkan. Oleh karena itu penilaian "
                "terhadap komponen perlu mempertimbangkan konteksnya masing masing. "
                "Kesimpulannya, hasil akhir perlu dipahami secara holistik sesuai "
                "konteks penerapannya."
            ),
        ],
        # Ragam sangat baku, frasa klise, tanpa keraguan dan tanpa rujukan konkret.
        AiBand.HIGH: [
            # Kognitif kuat: penalaran dan penilaian tetap ada meski gaya formulaik.
            (
                "Secara fundamental, " + base + " dapat dikonseptualisasikan "
                "sebagai sistem yang saling terhubung. Komponen awal menentukan "
                "keluaran komponen berikutnya, sehingga urutan pemrosesan memainkan "
                "peran penting. Namun demikian, terdapat perbedaan mendasar apabila "
                "dibandingkan dengan pendekatan konvensional. Pendekatan "
                "konvensional mengasumsikan independensi antarvariabel, sedangkan "
                "pendekatan kontemporer menekankan keterkaitan struktural. "
                "Perbedaan asumsi tersebut menyebabkan implikasi metodologis yang "
                "berbeda pula. Ditinjau dari efektivitasnya, pendekatan kontemporer "
                "lebih efektif untuk kasus kompleks. Kelebihan utamanya terletak "
                "pada akurasi prediksi, sementara kekurangannya adalah kebutuhan "
                "data yang lebih besar. Analisis komparatif memperlihatkan bahwa "
                "desain penerapan menentukan hasil akhirnya. Pertimbangan tersebut "
                "menjadi dasar perumusan rekomendasi yang lebih tepat sasaran. "
                "Kerangka analitis tersebut memungkinkan pemetaan hubungan "
                "antarvariabel secara sistematis. Pemetaan tersebut menghasilkan "
                "pemahaman yang lebih utuh terhadap mekanisme yang berlangsung. "
                "Evaluasi terhadap kedua pendekatan memperlihatkan bahwa pemilihan "
                "instrumen seharusnya mempertimbangkan ketersediaan sumber daya. "
                "Implikasi tersebut berlaku pada berbagai konteks penerapan. "
                "Dengan mempertimbangkan seluruh aspek tersebut, pendekatan "
                "kontemporer dinilai lebih unggul untuk kasus berskala besar."
            ),
            # Kognitif lemah: gaya formulaik tapi isinya sekadar menyebutkan.
            (
                "Di era modern ini, " + base + " tidak dapat dipungkiri memainkan "
                "peran penting. Secara fundamental, hal tersebut melibatkan banyak "
                "variabel. Dalam konteks ini, setiap variabel memiliki peran "
                "spesifik yang berkontribusi secara holistik. Terdapat beberapa "
                "komponen utama di dalamnya. Komponen tersebut meliputi aspek "
                "pertama, aspek kedua, dan aspek ketiga. Masing masing komponen "
                "memiliki definisi dan karakteristik tersendiri. Uraian tersebut "
                "memperlihatkan struktur yang kompleks."
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

            def _ensure_memberships(target_class: Class) -> None:
                for student in students:
                    ClassMembership.objects.get_or_create(
                        class_ref=target_class,
                        student_profile=student,
                    )

            class_metpen = _ensure_class(
                owner=teacher,
                label="metpen-a",
                name="Metodologi Penelitian A",
                subject="Metodologi Penelitian",
                level=EducationLevel.S1,
                program_studi="Sistem Informasi",
                semester=5,
            )
            class_ekbang = _ensure_class(
                owner=teacher,
                label="ekbang-b",
                name="Ekonomi Pembangunan B",
                subject="Ekonomi Pembangunan",
                level=EducationLevel.S1,
                program_studi="Ilmu Ekonomi",
                semester=3,
            )
            _ensure_memberships(class_metpen)
            _ensure_memberships(class_ekbang)

            # Tugas disebar lintas minggu supaya Profil Kognitif punya sumbu
            # waktu yang nyata. Satu titik per mahasiswa tidak membentuk tren
            # apa pun, dan layar itu akan kosong.
            series = {
                class_metpen: [
                    ("rumusan-masalah", "Merumuskan masalah penelitian",
                     "Rumuskan masalah penelitian skripsi Anda beserta alasan pemilihannya.", 3, 10),
                    ("kajian-pustaka", "Menyusun kajian pustaka",
                     "Bandingkan tiga sumber tentang topik Anda, lalu tunjukkan celah penelitiannya.", 4, 8),
                    ("desain-kualitatif", "Desain penelitian kualitatif",
                     "Uraikan pertimbangan dalam memilih desain penelitian kualitatif untuk topik skripsi Anda.", 3, 6),
                    ("validitas-reliabilitas", "Validitas dan reliabilitas instrumen",
                     "Bandingkan ancaman terhadap validitas dan reliabilitas, lalu jelaskan cara menanganinya.", 4, 4),
                    ("analisis-data", "Rencana analisis data",
                     "Rancang langkah analisis data yang sesuai dengan desain penelitian Anda.", 5, 1),
                ],
                class_ekbang: [
                    ("indikator-pembangunan", "Memilih indikator pembangunan",
                     "Pilih indikator yang paling tepat untuk mengukur pembangunan daerah, dan pertahankan pilihan Anda.", 4, 7),
                    ("subsidi-energi", "Efektivitas kebijakan subsidi energi",
                     "Bandingkan subsidi harga dan transfer langsung, lalu argumentasikan mana yang lebih tepat sasaran.", 4, 5),
                    ("ketimpangan-wilayah", "Ketimpangan antarwilayah",
                     "Jelaskan sebab ketimpangan antarwilayah dan usulkan satu kebijakan penanganannya.", 5, 2),
                ],
            }

            # Satu tugas yang masih berjalan per kelas, sengaja tanpa submission.
            # Tanpa ini seluruh data demo berada di masa lalu, sehingga layar
            # "masih berjalan" dan "perlu dikerjakan" selalu kosong dan alur
            # mengumpulkan tugas tidak pernah bisa dicoba.
            open_items = {
                class_metpen: (
                    "etika-penelitian",
                    "Etika penelitian dan persetujuan responden",
                    "Uraikan risiko etis pada rancangan penelitian Anda, lalu jelaskan cara Anda menanganinya.",
                    4,
                ),
                class_ekbang: (
                    "kebijakan-fiskal-daerah",
                    "Ruang fiskal pemerintah daerah",
                    "Nilai apakah ruang fiskal daerah Anda cukup untuk membiayai satu program prioritas, dan pertahankan penilaian itu.",
                    5,
                ),
            }

            assignments = []
            total_submissions = 0
            for target_class, items in series.items():
                for step, (label, title, instructions, bloom, weeks_ago) in enumerate(items):
                    assignment = _ensure_assignment(
                        target_class=target_class,
                        label=label,
                        title=title,
                        instructions=instructions,
                        expected_bloom_level=bloom,
                        # Tenggat relatif terhadap waktu pengumpulannya, bukan
                        # terhadap hari ini, supaya tugas lama tidak tampil
                        # seperti masih berjalan.
                        deadline_days=-(weeks_ago * 7) + 7,
                    )
                    assignments.append(assignment)
                    total_submissions += _seed_submissions_for_assignment(
                        rng=rng,
                        assignment=assignment,
                        students=students,
                        step=step,
                        total_steps=len(items),
                        weeks_ago=weeks_ago,
                    )

            verification_count = _seed_verifications(students, assignments)

            for target_class, (label, title, instructions, bloom) in open_items.items():
                assignments.append(
                    _ensure_assignment(
                        target_class=target_class,
                        label=label,
                        title=title,
                        instructions=instructions,
                        expected_bloom_level=bloom,
                        deadline_days=10,
                    )
                )

            materials = _seed_materials({"metpen-a": class_metpen, "ekbang-b": class_ekbang})
            notification_count = _seed_notifications(
                teacher, students, assignments, materials
            )

        self.stdout.write(
            "Seeded teacher={teacher_id}, classes=2, assignments={assignments}, "
            "submissions={submissions}, analysis_results={submissions}, "
            "verifications={verifications}, materials={materials}, "
            "notifications={notifications}".format(
                teacher_id=teacher.id,
                assignments=len(assignments),
                submissions=total_submissions,
                verifications=verification_count,
                materials=len(materials),
                notifications=notification_count,
            )
        )
        self.stdout.write(
            "Akun demo (password semua: {password}): dosen={teacher_email}, "
            "mahasiswa=mhs01@thinkpath.local s.d. mhs08@thinkpath.local".format(
                password=SEED_PASSWORD,
                teacher_email=TEACHER_EMAIL,
            )
        )
