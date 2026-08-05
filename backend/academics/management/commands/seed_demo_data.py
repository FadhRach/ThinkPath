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
from academics.process_signals import ProcessContext
from academics.models import (
    AiBand,
    AnalysisResult,
    AnalysisSource,
    Assignment,
    Class,
    ClassMembership,
    Confidence,
    EventType,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
)
from core.models import EducationLevel, Profile, Role


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
    deadline = timezone.now() + timedelta(days=deadline_days)
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


# Profil submission menentukan distribusi durasi, revisi, paste, band.
_PROFILES = (
    ("natural", 4, (20 * 60, 45 * 60), (2, 6), False, AiBand.LOW, (5, 30)),
    ("ambiguous", 2, (8 * 60, 15 * 60), (1, 2), True, AiBand.MID, (35, 65)),
    ("review", 2, (2 * 60, 5 * 60), (0, 1), True, AiBand.HIGH, (70, 92)),
)


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
        raise RuntimeError("Butuh setidaknya 8 profil mahasiswa untuk seed assignment.")

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

            # Sebagian profil "natural" sudah dinilai dosen agar UI
            # memperlihatkan status Dinilai + umpan balik.
            is_graded = profile_name == "natural" and index < 2
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

            # Tidak ada angka yang ditulis tangan lagi. Seluruh baris demo
            # dihitung oleh pipeline yang sama dengan jalur produksi, termasuk
            # sinyal forensik proses dari durasi, revisi, dan tempelan di atas.
            #
            # Sebaran band tetap terjaga karena profil pengerjaan memang sudah
            # dirancang berbeda: "natural" 20-45 menit dengan banyak revisi,
            # "review" 2-5 menit tanpa revisi dan dengan tempelan besar.
            analysis = analyze_text(
                submission.text_answer,
                assignment.expected_bloom_level,
                ProcessContext(
                    duration_seconds=duration_seconds,
                    revision_count=revision_count,
                    word_count=len(submission.text_answer.split()),
                    char_count=len(submission.text_answer),
                    paste_char_count=_seed_paste_chars(submission),
                ),
            )
            analysis["analysis_source"] = AnalysisSource.SEED
            AnalysisResult.objects.update_or_create(
                submission=submission,
                defaults=analysis,
            )
            created += 1
    return created


def _seed_paste_chars(submission: Submission) -> int:
    total = 0
    for event in submission.reasoning_events.all():
        if event.event_type != EventType.PASTE:
            continue
        value = (event.payload or {}).get("char_count")
        if isinstance(value, int):
            total += value
    return total


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
        # Campuran: sebagian baku, sebagian masih menyisakan suara penulisnya.
        AiBand.MID: [
            # Kognitif menengah: menjelaskan ulang dan menguraikan langkah.
            (
                base.capitalize() + " merupakan rangkaian proses yang dapat "
                "dijelaskan dalam beberapa tahap. Artinya, ada urutan yang perlu "
                "diikuti supaya hasilnya sesuai. Pertama, kondisi awal disiapkan "
                "terlebih dahulu. Kemudian kondisi tersebut diproses pada tahap "
                "berikutnya. Setelah itu hasilnya dapat diamati dan dicatat. Caranya "
                "kurang lebih seperti yang dicontohkan pada modul praktikum. Saya "
                "menerapkan langkah yang sama ketika mengerjakan studi kasus "
                "sebelumnya."
            ),
            # Kognitif kuat: sebab akibat dan pembandingan yang eksplisit.
            (
                "Berdasarkan bacaan, " + base + " mencakup beberapa komponen yang "
                "saling mempengaruhi. Komponen pertama menentukan hasil komponen "
                "kedua, sehingga urutannya penting. Namun apabila dibandingkan "
                "dengan kasus yang dibahas di kelas, ada perbedaan yang cukup jelas. "
                "Pada kasus di kelas faktor eksternal hampir tidak berpengaruh, "
                "sedangkan pada contoh di literatur faktor eksternal justru "
                "menyebabkan hasilnya berubah. Perbedaan ini muncul karena kondisi "
                "awalnya memang tidak sama. Kesimpulannya bergantung pada konteks."
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

            assignments = [
                _ensure_assignment(
                    target_class=class_metpen,
                    label="desain-kualitatif",
                    title="Desain penelitian kualitatif",
                    instructions="Uraikan pertimbangan dalam memilih desain penelitian kualitatif untuk topik skripsi Anda.",
                    expected_bloom_level=3,
                    deadline_days=5,
                ),
                _ensure_assignment(
                    target_class=class_ekbang,
                    label="subsidi-energi",
                    title="Efektivitas kebijakan subsidi energi",
                    instructions="Bandingkan subsidi harga dan transfer langsung, lalu argumentasikan mana yang lebih tepat sasaran.",
                    expected_bloom_level=4,
                    deadline_days=7,
                ),
                _ensure_assignment(
                    target_class=class_metpen,
                    label="validitas-reliabilitas",
                    title="Validitas dan reliabilitas instrumen",
                    instructions="Bandingkan ancaman terhadap validitas dan reliabilitas, lalu jelaskan cara menanganinya.",
                    expected_bloom_level=4,
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
        self.stdout.write(
            "Akun demo (password semua: {password}): dosen={teacher_email}, "
            "mahasiswa=mhs01@thinkpath.local s.d. mhs08@thinkpath.local".format(
                password=SEED_PASSWORD,
                teacher_email=TEACHER_EMAIL,
            )
        )
