"""Seed data demo: 2 dosen, 20 mahasiswa, 4 kelas di tengah semester.

Tiap kelas punya 12 sesi, 12 materi, dan 12 tugas (katalognya di `apps/academics/demo/courses.py`).
Hari ini jatuh di pekan sesi ke-10:

- tugas 1-7/8 sudah dinilai, satu tugas setengah dinilai, tugas 9 lewat tenggat dan menunggu nilai;
- tugas 10 masih berjalan (sebagian mahasiswa sudah mengumpulkan, mhs01 belum, supaya juri bisa
  mencoba mengumpulkan);
- tugas 11 dan 12 sudah diterbitkan dosen, tenggatnya masih jauh.

Jawaban ditulis generator (`demo/answers.py`) dengan gaya menulis per mahasiswa. Ada jawaban
berkode, bertautan, dan berupa PDF unggahan. Seluruh skor dihitung pipeline heuristik yang sama
dengan produksi, tidak ada angka yang ditulis tangan.

Idempoten: semua id memakai uuid5, jadi menjalankan ulang memperbarui baris yang sama.
"""
from __future__ import annotations

import random
import uuid
from datetime import timedelta

import pymupdf
from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.academics.demo.answers import STUDENTS, code_for, compose, depth_for, nim_for
from apps.academics.demo.courses import COURSES, PROGRAM, SEMESTER, TEACHERS, Course, Session
from apps.academics.models import (
    Assignment,
    Class,
    ClassMembership,
    EventType,
    Material,
    ReasoningEvent,
    Submission,
    SubmissionStatus,
)
from apps.academics.services.documents import combine_with_document
from apps.academics.services.join_codes import generate_unique_join_code
from apps.academics.services.rich_text import clean_rich_doc, rich_to_plain
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import SOURCE_SEED, current_consent, items_for, record_consent
from apps.analysis.choices import AnalysisSource
from apps.analysis.engines.heuristic import analyze_text
from apps.analysis.engines.process_signals import ProcessContext, ProgressSample, assess_process
from apps.analysis.models import AnalysisResult
from apps.cekpaham.models import CekPaham, RequestStatus
from apps.cekpaham.seed import seed_cekpaham_demo
from apps.forum.seed import seed_forum_demo
from apps.notifications import events as notify_events
from apps.notifications.models import Notification, NotificationKind
from apps.todos.seed import seed_todos_demo

SEED_NAMESPACE = uuid.UUID("8c5ff61a-94e0-4f3a-9d4e-4ad27d2e8d3c")
SEED_PASSWORD = "thinkpath123"
# Kelas dari versi seed sebelumnya; dihapus supaya akun demo tidak menampilkan kelas lama.
LEGACY_CLASSES = ("metpen-a", "ekbang-b")

CURRENT_SESSION = 10
SAMPLE_SECONDS = 30
MIXED_QUOTE_SHARE = 0.3
# Pasangan salin yang disengaja: (kelas, tugas) -> (penyalin, sumber). Kartu kemiripan dosen
# menampilkannya sebagai sangat mirip.
COPIES = {("ai", 6): (18, 6), ("os", 8): (18, 6)}
# Mahasiswa yang dipakai seed Cek Paham harus mengumpulkan tugas ini.
CEKPAHAM_TASK = ("algo", 9)

FEEDBACK = {
    2: (
        "Analisis perbandingannya kuat dan alasannya jelas. Pertahankan.",
        "Bagus, kamu menguji pilihanmu dengan contoh sendiri. Coba tambahkan batasan analisisnya.",
        "Argumen runtut dan didukung contoh konkret.",
    ),
    1: (
        "Penjelasan sudah benar, tetapi perbandingannya masih bisa diperdalam.",
        "Langkahnya jelas. Tambahkan alasan kenapa memilih pendekatan itu.",
        "Cukup baik. Lain kali sertakan juga kasus uji yang gagal.",
    ),
    0: (
        "Masih berupa daftar poin dari slide. Coba jelaskan hubungan antarkonsepnya.",
        "Jawaban terlalu singkat. Tambahkan contoh dan alasan.",
        "Belum menjawab pertanyaan utama. Silakan konsultasi di jam kantor.",
    ),
}


def _id(label: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, label)


# --- akun ---------------------------------------------------------------------------------


def _ensure_profile(label: str, email: str, name: str, role: str, password: str) -> Profile:
    profile, _ = Profile.objects.update_or_create(
        id=_id(label),
        defaults={
            "email": email,
            "password": password,
            "display_name": name,
            "role": role,
            "education_level": EducationLevel.S1 if role == Role.STUDENT else "",
        },
    )
    # Akun demo sudah menyetujui kebijakan, jadi login langsung masuk aplikasi.
    if current_consent(profile.id) is None:
        record_consent(profile.id, ConsentAction.GIVEN, items_for(profile.role), source=SOURCE_SEED)
    return profile


# --- waktu --------------------------------------------------------------------------------


def _session_at(course: Course, number: int):
    days = (CURRENT_SESSION - number) * 7 + course.day_offset
    return (timezone.now() - timedelta(days=days)).replace(hour=2, minute=0, second=0, microsecond=0)


def _deadline(course: Course, number: int):
    # 23.59 WIB sepekan setelah pertemuan.
    return (_session_at(course, number) + timedelta(days=7)).replace(hour=16, minute=59)


# --- kelas, materi, tugas -----------------------------------------------------------------


def _ensure_class(course: Course, owner: Profile) -> Class:
    defaults = {
        "owner": owner,
        "name": course.name,
        "subject": course.subject,
        "education_level": EducationLevel.S1,
        "program_studi": PROGRAM,
        "semester": SEMESTER,
    }
    klass = Class.objects.filter(pk=_id(f"class:{course.label}")).first()
    if klass is None:
        return Class.objects.create(id=_id(f"class:{course.label}"), join_code=generate_unique_join_code(), **defaults)
    for key, value in defaults.items():
        setattr(klass, key, value)
    klass.save()
    return klass


def _paragraph(text: str, marks: list | None = None) -> dict:
    node = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return {"type": "paragraph", "content": [node]}


def _link_paragraph(prefix: str, label: str, href: str) -> dict:
    return {
        "type": "paragraph",
        "content": [
            {"type": "text", "text": prefix},
            {"type": "text", "text": label, "marks": [{"type": "link", "attrs": {"href": href}}]},
        ],
    }


def _instructions(session: Session) -> tuple[str, dict | None]:
    """Instruksi polos, plus versi berformat bila tugas punya ketentuan."""
    if not session.requirements:
        return session.instructions, None
    content = [
        _paragraph(session.instructions),
        _paragraph("Ketentuan:", [{"type": "bold"}]),
        {
            "type": "bulletList",
            "content": [{"type": "listItem", "content": [_paragraph(item)]} for item in session.requirements],
        },
    ]
    title, _, url = session.material
    if url:
        content.append(_link_paragraph("Bacaan pendukung: ", title, url))
    doc = clean_rich_doc({"type": "doc", "content": content})
    return rich_to_plain(doc), doc


def _ensure_session(course: Course, klass: Class, number: int, session: Session) -> tuple[Assignment, Material]:
    now = timezone.now()
    instructions, rich = _instructions(session)
    assignment, _ = Assignment.objects.update_or_create(
        id=_id(f"assignment:{course.label}:{number}"),
        defaults={
            "class_ref": klass,
            "title": session.title,
            "instructions": instructions,
            "instructions_rich": rich,
            "deadline": _deadline(course, number),
            "expected_bloom_level": session.bloom,
            "allow_file_upload": session.kind == "dokumen",
        },
    )
    # Dosen menyiapkan tugas sesi 11 dan 12 lebih awal, jadi diterbitkan kemarin.
    published = min(_session_at(course, number), now - timedelta(days=1))
    Assignment.objects.filter(pk=assignment.pk).update(created_at=published)

    title, description, url = session.material
    material, _ = Material.objects.update_or_create(
        id=_id(f"material:{course.label}:{number}"),
        defaults={
            "class_ref": klass,
            "topic": f"Sesi {number}: {session.topic}",
            "title": title,
            "description": description,
            "url": url,
        },
    )
    shared = min(_session_at(course, number) - timedelta(days=1), now - timedelta(hours=6))
    Material.objects.filter(pk=material.pk).update(created_at=shared)
    material.refresh_from_db()
    return assignment, material


# --- jawaban ------------------------------------------------------------------------------


def _paragraphs(index: int, course: Course, number: int, session: Session) -> tuple[list[str], int]:
    """Paragraf jawaban mahasiswa ke-`index`; deterministik untuk kelas dan tugas yang sama."""
    rng = random.Random(f"answer:{index}:{course.label}:{number}")
    persona = STUDENTS[index]
    depth = depth_for(persona.trajectory, number - 1, len(course.sessions), rng)
    return compose(rng, persona, depth, session.slots), depth


def _handle(index: int) -> str:
    first = STUDENTS[index].name.split()[0].lower()
    return f"{first}{nim_for(index)[-3:]}"


def _typed_doc(index: int, course: Course, number: int, session: Session, paragraphs: list[str]) -> dict:
    rng = random.Random(f"extras:{index}:{course.label}:{number}")
    blocks = [_paragraph(line) for para in paragraphs for line in para.split("\n")]
    if session.kind == "kode":
        code = code_for(rng, session.code)
        blocks.insert(1, {"type": "codeBlock", "attrs": {"language": "python"}, "content": [{"type": "text", "text": code}]})
    elif session.kind == "tautan":
        token = uuid.uuid5(SEED_NAMESPACE, f"link:{index}:{course.label}").hex
        link = {
            "algo": ("Repositori: ", f"https://github.com/{_handle(index)}/algoprog-semester3"),
            "ai": ("Notebook Colab: ", f"https://colab.research.google.com/drive/1{token[:32]}"),
            "biz": ("Prototipe: ", f"https://www.figma.com/proto/{token[:22]}/mvp-katering-sehat"),
        }[course.label]
        blocks.append(_link_paragraph(link[0], link[1], link[1]))
    else:
        title, _, url = session.material
        if url and STUDENTS[index].band != "high" and rng.random() < 0.3:
            blocks.append(_link_paragraph("Referensi tambahan yang saya baca: ", title, url))
    return clean_rich_doc({"type": "doc", "content": blocks})


def _store_pdf(student: Profile, document_id: uuid.UUID, text: str) -> None:
    """Berkas PDF dan teks hasil bacanya, di jalur yang sama dengan unggahan sungguhan."""
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_textbox(pymupdf.Rect(56, 56, 540, 800), text, fontsize=10.5, fontname="helv")
    base = f"documents/{student.id}/{document_id}"
    for name, data in ((f"{base}.pdf", pdf.tobytes()), (f"{base}.txt", text.encode("utf-8"))):
        default_storage.delete(name)  # save() tidak menimpa, ia mengganti nama
        default_storage.save(name, ContentFile(data))


def _simulate_session(rng: random.Random, style: str, words_total: int, duration: int) -> list[ProgressSample]:
    """Cuplikan jumlah kata tiap 30 detik, meniru rekaman draf di produksi."""
    offsets = list(range(0, duration, SAMPLE_SECONDS)) + [duration]
    if style == "tempel":
        return [ProgressSample(offset_seconds=o, word_count=0 if o == 0 else words_total) for o in offsets]
    quoted = round(words_total * MIXED_QUOTE_SHARE) if style == "campur" else 0
    typed = words_total - quoted
    quote_at = offsets[max(1, round(len(offsets) * rng.uniform(0.33, 0.5)))] if quoted else None
    samples = []
    for offset in offsets:
        words = round(typed * offset / duration) if duration else typed
        if quote_at is not None and offset >= quote_at:
            words += quoted
        if 0 < offset < duration:
            words = max(0, words - rng.choice((0, 0, 0, 1, 2)))
        samples.append(ProgressSample(offset_seconds=offset, word_count=words_total if offset == duration else words))
    return samples


def _seed_submissions(course: Course, number: int, session: Session, assignment: Assignment,
                      students: list[Profile]) -> tuple[list[uuid.UUID], list[ReasoningEvent]]:
    now = timezone.now()
    # Sama dengan created_at tugas: sesi 11-12 diterbitkan lebih awal (kemarin).
    published = min(_session_at(course, number), now - timedelta(days=1))
    deadline = _deadline(course, number)
    kept: list[uuid.UUID] = []
    events: list[ReasoningEvent] = []

    for index, (persona, student) in enumerate(zip(STUDENTS, students)):
        rng = random.Random(f"submission:{index}:{course.label}:{number}")
        copy = COPIES.get((course.label, number))
        forced = (course.label, number) == CEKPAHAM_TASK and index in (5, 6, 7)
        forced = forced or (copy is not None and index in copy) or (index == 0 and number <= 9)
        if number <= 9:
            submits = forced or rng.random() >= persona.skip
        elif number == 10:
            submits = index != 0 and rng.random() < 0.55
        elif number == 11:
            submits = index != 0 and persona.trajectory == "kuat" and rng.random() < 0.4
        else:
            submits = False
        if not submits:
            continue

        paragraphs, depth = _paragraphs(index, course, number, session)
        if copy is not None and index == copy[0]:
            source, _ = _paragraphs(copy[1], course, number, session)
            paragraphs = ["Berikut jawaban saya. " + source[0], *source[1:]]

        latest = min(deadline, now) - timedelta(minutes=30)
        earliest = published + timedelta(hours=2)
        first_at = latest - (latest - earliest) * rng.random() ** 2
        is_document = session.kind == "dokumen" and rng.random() < persona.doc_pref
        submission_id = _id(f"submission:{assignment.id}:{index}")
        kept.append(submission_id)

        if is_document:
            nim = nim_for(index)
            document_id = _id(f"document:{assignment.id}:{index}")
            body = "\n\n".join(paragraphs)
            doc_text = f"{session.title}\n\n{persona.name}\nNIM {nim}\n\n{body}"
            _store_pdf(student, document_id, doc_text)
            note = f"{persona.name} - {nim}. Laporan lengkap ada di PDF terlampir."
            rich = clean_rich_doc({"type": "doc", "content": [_paragraph(note)]})
            text = combine_with_document(note, doc_text)
            duration = rng.randint(60, 240)
            revised_at = None
        else:
            document_id = None
            rich = _typed_doc(index, course, number, session, paragraphs)
            text = rich_to_plain(rich)
            duration = rng.randint(persona.minutes[0] * 60, persona.minutes[1] * 60)
            revised_at = first_at + timedelta(hours=rng.randint(2, 20)) if persona.revises and rng.random() < 0.35 else None
            if revised_at is not None and revised_at >= latest:
                revised_at = None

        graded = number <= course.graded_through or (number in course.partially_graded and rng.random() < 0.5)
        if graded:
            grade = max(50, min(98, {0: 66, 1: 78, 2: 87}[depth] + rng.randint(-6, 6)))
            feedback = "" if rng.random() < 0.2 else rng.choice(FEEDBACK[depth])
        else:
            grade, feedback = None, ""

        started_at = first_at - timedelta(seconds=duration)
        submission, _ = Submission.objects.update_or_create(
            id=submission_id,
            defaults={
                "assignment": assignment,
                "student_profile": student,
                "text_answer": text,
                "rich_answer": rich,
                "source_document": document_id,
                "started_at": started_at,
                "submitted_at": revised_at or first_at,
                "duration_seconds": duration,
                "revision_count": 1 if revised_at else 0,
                "status": SubmissionStatus.REVIEWED if graded else SubmissionStatus.SUBMITTED,
                "grade": grade,
                "teacher_feedback": feedback,
            },
        )

        # Jawaban dari dokumen tidak punya jejak mengetik, persis seperti di produksi.
        samples = [] if is_document else _simulate_session(rng, persona.style, len(text.split()), duration)
        process = None if is_document else ProcessContext(
            duration_seconds=duration,
            revision_count=submission.revision_count,
            word_count=len(text.split()),
            char_count=len(text),
            progress=tuple(samples),
        )
        events += _events(submission, started_at, first_at, revised_at, samples)

        analysis = analyze_text(text, assignment.expected_bloom_level, process)
        assessment = assess_process(process)
        analysis.update(
            process_band=assessment.band,
            process_evidence=assessment.evidence,
            analysis_source=AnalysisSource.SEED,
        )
        AnalysisResult.objects.update_or_create(submission=submission, defaults=analysis)

    Submission.objects.filter(assignment=assignment).exclude(id__in=kept).delete()
    return kept, events


def _events(submission, started_at, first_at, revised_at, samples) -> list[ReasoningEvent]:
    """Event dengan bentuk yang sama dengan yang ditulis jalur pengumpulan produksi."""
    sid = submission.id
    rows = [
        ReasoningEvent(id=_id(f"event:{sid}:started"), submission=submission, event_type=EventType.STARTED, payload={}, occurred_at=started_at),
        ReasoningEvent(id=_id(f"event:{sid}:submitted"), submission=submission, event_type=EventType.SUBMITTED, payload={}, occurred_at=first_at),
    ]
    rows += [
        ReasoningEvent(
            id=_id(f"event:{sid}:progress:{i}"),
            submission=submission,
            event_type=EventType.PROGRESS,
            payload={"word_count": sample.word_count},
            occurred_at=started_at + timedelta(seconds=sample.offset_seconds),
        )
        for i, sample in enumerate(samples)
    ]
    if revised_at is not None:
        rows.append(
            ReasoningEvent(
                id=_id(f"event:{sid}:revision:1"), submission=submission, event_type=EventType.REVISION,
                payload={"revision_count": 1}, occurred_at=revised_at,
            )
        )
    return rows


# --- notifikasi ---------------------------------------------------------------------------


def _seed_notifications(teachers, students, assignments, materials) -> int:
    """Isi lonceng akun demo lewat fungsi peristiwa yang sama dengan produksi.

    Notifikasi lama dihapus dulu supaya idempoten; waktunya lalu disetel ke saat peristiwanya
    terjadi, dan yang lama ditandai dibaca.
    """
    now = timezone.now()
    profiles = [*teachers, *students]
    Notification.objects.filter(recipient__in=profiles).delete()
    mine = Notification.objects.filter(recipient__in=profiles)

    # Dosen: pengumpulan tugas yang terakhir lewat tenggat di tiap kelas, digabung per tugas.
    latest: dict = {}
    for assignment in assignments:
        if assignment.deadline < now:
            current = latest.get(assignment.class_ref_id)
            if current is None or assignment.deadline > current.deadline:
                latest[assignment.class_ref_id] = assignment
    for assignment in latest.values():
        rows = list(assignment.submissions.select_related("student_profile", "assignment__class_ref").order_by("submitted_at"))
        for submission in rows:
            notify_events.submission_received(submission, revised=False)
        if rows:
            mine.filter(group_key=f"submissions:{assignment.id}").update(created_at=rows[-1].submitted_at)

    # Mahasiswa: tugas yang masih berjalan dan materi terbaru tiap kelas.
    for assignment in assignments:
        if assignment.deadline > now:
            notify_events.assignment_created(assignment)
    mine.filter(kind=NotificationKind.ASSIGNMENT_NEW).update(created_at=now - timedelta(hours=5))
    newest: dict = {}
    for material in materials:
        current = newest.get(material.class_ref_id)
        if current is None or material.created_at > current.created_at:
            newest[material.class_ref_id] = material
    for material in newest.values():
        notify_events.material_created(material)
        mine.filter(kind=NotificationKind.MATERIAL_NEW, title__endswith=material.title).update(created_at=material.created_at)

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
        mine.filter(recipient=student, kind=NotificationKind.SUBMISSION_GRADED).update(created_at=at, read_at=at + timedelta(hours=2))

    # Cek Paham yang jendelanya masih terbuka dan belum dikerjakan.
    for cekpaham in CekPaham.objects.filter(
        status=RequestStatus.ACTIVE, window_end__gt=now, attempts__isnull=True, submission__student_profile__in=students
    ).select_related("submission__assignment__class_ref"):
        notify_events.cekpaham_created(cekpaham)
    mine.filter(kind=NotificationKind.CEKPAHAM_NEW).update(created_at=now - timedelta(hours=3))
    return mine.count()


class Command(BaseCommand):
    help = "Seed data demo: 2 dosen, 20 mahasiswa, 4 kelas di tengah semester (idempoten)."

    def handle(self, *args, **options):
        with transaction.atomic():
            Class.objects.filter(id__in=[_id(f"class:{label}") for label in LEGACY_CLASSES]).delete()
            # Satu hash untuk semua akun: PBKDF2 sengaja lambat, dan sandinya memang sama.
            password = make_password(SEED_PASSWORD)
            teachers = {
                # "teacher:demo" dipertahankan supaya id dosen lama tetap sama.
                key: _ensure_profile("teacher:demo" if key == "budi" else f"teacher:{key}", email, name, Role.TEACHER, password)
                for key, (email, name) in TEACHERS.items()
            }
            students = [
                _ensure_profile(f"student:{i:02d}", f"mhs{i:02d}@thinkpath.local", persona.name, Role.STUDENT, password)
                for i, persona in enumerate(STUDENTS, start=1)
            ]

            classes: dict[str, Class] = {}
            assignments: list[Assignment] = []
            materials: list[Material] = []
            by_key: dict[tuple[str, int], Assignment] = {}
            submission_ids: list[uuid.UUID] = []
            events: list[ReasoningEvent] = []
            for course in COURSES:
                klass = _ensure_class(course, teachers[course.teacher])
                classes[course.label] = klass
                for student in students:
                    ClassMembership.objects.get_or_create(class_ref=klass, student_profile=student)
                # Semua bergabung di pekan pertama, bukan pada hari seed dijalankan.
                ClassMembership.objects.filter(class_ref=klass).update(
                    joined_at=_session_at(course, 1) - timedelta(days=3)
                )
                Class.objects.filter(pk=klass.pk).update(created_at=_session_at(course, 1) - timedelta(days=10))
                for number, session in enumerate(course.sessions, start=1):
                    assignment, material = _ensure_session(course, klass, number, session)
                    assignments.append(assignment)
                    materials.append(material)
                    by_key[(course.label, number)] = assignment
                    kept, rows = _seed_submissions(course, number, session, assignment, students)
                    submission_ids += kept
                    events += rows

            ReasoningEvent.objects.filter(submission_id__in=submission_ids).delete()
            ReasoningEvent.objects.bulk_create(events, batch_size=2000)

            cekpaham_count = seed_cekpaham_demo(teachers["budi"], students, by_key[CEKPAHAM_TASK])
            forum_count = seed_forum_demo(classes, students)
            seed_todos_demo(students[0])
            notification_count = _seed_notifications(list(teachers.values()), students, assignments, materials)

        self.stdout.write(
            f"Seeded classes={len(classes)}, assignments={len(assignments)}, materials={len(materials)}, "
            f"submissions={len(submission_ids)}, cekpaham={cekpaham_count}, forum_posts={forum_count}, "
            f"notifications={notification_count}"
        )
        self.stdout.write(
            f"Akun demo (password {SEED_PASSWORD}): {TEACHERS['budi'][0]} (3 kelas), "
            f"{TEACHERS['hendra'][0]} (Business Creation), mhs01..mhs{len(STUDENTS):02d}@thinkpath.local."
        )
