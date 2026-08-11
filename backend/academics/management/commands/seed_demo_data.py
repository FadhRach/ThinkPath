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
_STUDENT_PROFILES = (
    # (band, lintasan, rentang durasi, rentang revisi, ada tempelan besar)
    (AiBand.LOW, "naik", (20 * 60, 45 * 60), (2, 6), False),
    (AiBand.LOW, "datar", (22 * 60, 48 * 60), (2, 6), False),
    (AiBand.LOW, "naik", (25 * 60, 50 * 60), (3, 7), False),
    (AiBand.LOW, "turun", (20 * 60, 40 * 60), (2, 5), False),
    (AiBand.MID, "datar", (8 * 60, 15 * 60), (1, 2), True),
    (AiBand.MID, "naik", (9 * 60, 18 * 60), (1, 3), True),
    (AiBand.HIGH, "datar", (2 * 60, 5 * 60), (0, 1), True),
    (AiBand.HIGH, "turun", (2 * 60, 6 * 60), (0, 1), True),
)


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

    for index, (band, trajectory, duration_range, revision_range, has_paste) in enumerate(
        _STUDENT_PROFILES
    ):
        student = students[index]
        duration_seconds = rng.randint(*duration_range)
        revision_count = rng.randint(*revision_range)
        submitted_at = timezone.now() - timedelta(
            weeks=weeks_ago, hours=rng.randint(1, 40)
        )
        started_at = submitted_at - timedelta(seconds=duration_seconds)

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

        # Tidak ada angka yang ditulis tangan. Seluruh baris demo dihitung
        # pipeline yang sama dengan jalur produksi, termasuk sinyal forensik
        # proses dari durasi, revisi, dan tempelan di atas.
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
