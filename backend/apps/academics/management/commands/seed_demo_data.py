"""Seed data demo: 2 dosen, 20 mahasiswa, 4 kelas di pekan ke-10 semester.

Tiap kelas punya 12 sesi (materi + tugas, katalognya di `demo/courses.py`):
- tugas 1-7/8 sudah dinilai, satu tugas setengah dinilai, tugas 9 lewat tenggat dan menunggu nilai;
- tugas 10 berjalan: sebagian mahasiswa sudah mengumpulkan, mhs01 belum (QUICK_TASK untuk demo);
- tugas 11-12 sudah diterbitkan, tenggatnya masih jauh.

Jawaban ditulis generator (`demo/answers.py`) dengan gaya per mahasiswa; skor dihitung pipeline
heuristik produksi, tanpa API luar dan tanpa angka tulisan tangan.

Idempoten (uuid5). Menjalankan ulang juga membuang sisa latihan demo: jawaban di luar seed,
draf, dan sesi Cek Paham mhs01.
"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import pymupdf
from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.academics.demo.answers import STUDENTS, Persona, code_for, compose, depth_for, nim_for
from apps.academics.demo.courses import COURSES, PROGRAM, SEMESTER, TEACHERS, Course, Session
from apps.academics.models import (
    AnalysisState,
    Assignment,
    Class,
    ClassMembership,
    EventType,
    Material,
    ReasoningEvent,
    Submission,
    SubmissionDraft,
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

# --- skenario demo ------------------------------------------------------------------------

SEED_NAMESPACE = uuid.UUID("8c5ff61a-94e0-4f3a-9d4e-4ad27d2e8d3c")
SEED_PASSWORD = "thinkpath123"
LEGACY_CLASSES = ("metpen-a", "ekbang-b")  # kelas seed lama, dihapus

CURRENT_SESSION = 10  # pekan berjalan: tugas sesi ini masih terbuka
DEMO_STUDENT = 0  # mhs01: belum mengumpulkan tugas berjalan, punya Cek Paham terbuka
QUICK_TASK = ("algo", CURRENT_SESSION)  # tugas singkat yang dikerjakan mhs01 saat demo
CEKPAHAM_TASK = ("algo", 9)
# Pasangan salin (kelas, tugas) -> (penyalin, sumber), muncul di kartu kemiripan dosen.
COPIES = {("ai", 6): (18, 6), ("os", 8): (18, 6)}
ONGOING_SHARE = 0.55  # bagian mahasiswa yang sudah mengumpulkan tugas berjalan
EARLY_SHARE = 0.4  # mahasiswa "kuat" yang sudah mengumpulkan tugas pekan depan

SAMPLE_SECONDS = 30
MIXED_QUOTE_SHARE = 0.3
GRADE_BY_DEPTH = {0: 66, 1: 78, 2: 87}
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


# --- waktu --------------------------------------------------------------------------------


def _session_at(course: Course, number: int) -> datetime:
    days = (CURRENT_SESSION - number) * 7 + course.day_offset
    return (timezone.now() - timedelta(days=days)).replace(hour=2, minute=0, second=0, microsecond=0)


def _published_at(course: Course, number: int) -> datetime:
    # Tugas pekan depan disiapkan lebih awal, jadi tampak terbit kemarin.
    return min(_session_at(course, number), timezone.now() - timedelta(days=1))


def _deadline(course: Course, number: int) -> datetime:
    # 23.59 WIB sepekan setelah pertemuan.
    return (_session_at(course, number) + timedelta(days=7)).replace(hour=16, minute=59)


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
    # Persetujuan sudah tercatat, jadi login langsung masuk aplikasi.
    if current_consent(profile.id) is None:
        record_consent(profile.id, ConsentAction.GIVEN, items_for(profile.role), source=SOURCE_SEED)
    return profile


def _seed_accounts() -> tuple[dict[str, Profile], list[Profile]]:
    password = make_password(SEED_PASSWORD)  # satu hash: PBKDF2 sengaja lambat
    teachers = {
        # "teacher:demo" dipertahankan supaya id dosen lama tetap sama.
        key: _ensure_profile("teacher:demo" if key == "budi" else f"teacher:{key}", email, name, Role.TEACHER, password)
        for key, (email, name) in TEACHERS.items()
    }
    students = [
        _ensure_profile(f"student:{i:02d}", f"mhs{i:02d}@thinkpath.local", persona.name, Role.STUDENT, password)
        for i, persona in enumerate(STUDENTS, start=1)
    ]
    semester_start = min(_session_at(course, 1) for course in COURSES)
    Profile.objects.filter(id__in=[p.id for p in [*teachers.values(), *students]]).update(
        created_at=semester_start - timedelta(days=14)
    )
    return teachers, students


# --- kelas, materi, tugas -----------------------------------------------------------------


def _seed_class(course: Course, owner: Profile, students: list[Profile]) -> Class:
    defaults = {
        "owner": owner,
        "name": course.name,
        "subject": course.subject,
        "education_level": EducationLevel.S1,
        "program_studi": PROGRAM,
        "semester": SEMESTER,
    }
    pk = _id(f"class:{course.label}")
    klass = Class.objects.filter(pk=pk).first()
    if klass is None:
        klass = Class.objects.create(id=pk, join_code=generate_unique_join_code(), **defaults)
    else:
        Class.objects.filter(pk=pk).update(**defaults)
    for student in students:
        ClassMembership.objects.get_or_create(class_ref=klass, student_profile=student)
    first = _session_at(course, 1)
    ClassMembership.objects.filter(class_ref=klass).update(joined_at=first - timedelta(days=3))
    Class.objects.filter(pk=pk).update(created_at=first - timedelta(days=10))
    klass.refresh_from_db()
    return klass


def _paragraph(text: str, marks: list | None = None) -> dict:
    node = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return {"type": "paragraph", "content": [node]}


def _link_paragraph(prefix: str, label: str, href: str) -> dict:
    link = {"type": "text", "text": label, "marks": [{"type": "link", "attrs": {"href": href}}]}
    return {"type": "paragraph", "content": [{"type": "text", "text": prefix}, link]}


def _instructions(session: Session) -> tuple[str, dict | None]:
    """Instruksi polos, plus versi berformat bila tugas punya ketentuan."""
    if not session.requirements:
        return session.instructions, None
    items = [{"type": "listItem", "content": [_paragraph(item)]} for item in session.requirements]
    content = [
        _paragraph(session.instructions),
        _paragraph("Ketentuan:", [{"type": "bold"}]),
        {"type": "bulletList", "content": items},
    ]
    title, _, url = session.material
    if url:
        content.append(_link_paragraph("Bacaan pendukung: ", title, url))
    doc = clean_rich_doc({"type": "doc", "content": content})
    return rich_to_plain(doc), doc


def _seed_assignment(course: Course, klass: Class, number: int, session: Session) -> Assignment:
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
    Assignment.objects.filter(pk=assignment.pk).update(created_at=_published_at(course, number))
    return assignment


def _seed_material(course: Course, klass: Class, number: int, session: Session) -> Material:
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
    shared = min(_session_at(course, number) - timedelta(days=1), timezone.now() - timedelta(hours=6))
    Material.objects.filter(pk=material.pk).update(created_at=shared)
    material.refresh_from_db()
    return material


# --- jawaban ------------------------------------------------------------------------------


@dataclass
class Answer:
    text: str
    rich: dict
    document_id: uuid.UUID | None
    duration: int
    revised_at: datetime | None


def _submits(rng: random.Random, index: int, persona: Persona, course: Course, number: int) -> bool:
    if index in COPIES.get((course.label, number), ()):
        return True
    if number < CURRENT_SESSION:
        return rng.random() >= persona.skip
    if index == DEMO_STUDENT:
        return False  # mhs01 mengerjakan tugas berjalan secara langsung saat demo
    if number == CURRENT_SESSION:
        return rng.random() < ONGOING_SHARE
    if number == CURRENT_SESSION + 1:
        return persona.trajectory == "kuat" and rng.random() < EARLY_SHARE
    return False


def _paragraphs(index: int, course: Course, number: int, session: Session) -> tuple[list[str], int]:
    """Paragraf jawaban mahasiswa ke-`index`; deterministik per kelas dan tugas."""
    rng = random.Random(f"answer:{index}:{course.label}:{number}")
    persona = STUDENTS[index]
    depth = depth_for(persona.trajectory, number - 1, len(course.sessions), rng)
    paragraphs = compose(rng, persona, depth, session.slots)
    copy = COPIES.get((course.label, number))
    if copy and index == copy[0]:
        source, _ = _paragraphs(copy[1], course, number, session)
        paragraphs = ["Berikut jawaban saya. " + source[0], *source[1:]]
    return paragraphs, depth


def _handle(index: int) -> str:
    return f"{STUDENTS[index].name.split()[0].lower()}{nim_for(index)[-3:]}"


def _typed_doc(index: int, course: Course, number: int, session: Session, paragraphs: list[str]) -> dict:
    """Jawaban editor: paragraf plus blok kode, tautan hasil kerja, atau rujukan bacaan."""
    rng = random.Random(f"extras:{index}:{course.label}:{number}")
    blocks = [_paragraph(line) for para in paragraphs for line in para.split("\n")]
    if session.kind == "kode":
        code = {"type": "text", "text": code_for(rng, session.code)}
        blocks.insert(1, {"type": "codeBlock", "attrs": {"language": "python"}, "content": [code]})
    elif session.kind == "tautan":
        token = _id(f"link:{index}:{course.label}").hex
        prefix, href = {
            "algo": ("Repositori: ", f"https://github.com/{_handle(index)}/algoprog-semester3"),
            "ai": ("Notebook Colab: ", f"https://colab.research.google.com/drive/1{token[:32]}"),
            "biz": ("Prototipe: ", f"https://www.figma.com/proto/{token[:22]}/mvp-katering-sehat"),
        }[course.label]
        blocks.append(_link_paragraph(prefix, href, href))
    else:
        title, _, url = session.material
        if url and STUDENTS[index].band != "high" and rng.random() < 0.3:
            blocks.append(_link_paragraph("Referensi tambahan yang saya baca: ", title, url))
    return clean_rich_doc({"type": "doc", "content": blocks})


def _store_pdf(student: Profile, document_id: uuid.UUID, text: str) -> None:
    """PDF dan teks hasil bacanya, di jalur yang sama dengan unggahan sungguhan."""
    pdf = pymupdf.open()
    pdf.new_page().insert_textbox(pymupdf.Rect(56, 56, 540, 800), text, fontsize=10.5, fontname="helv")
    base = f"documents/{student.id}/{document_id}"
    for name, data in ((f"{base}.pdf", pdf.tobytes()), (f"{base}.txt", text.encode("utf-8"))):
        default_storage.delete(name)  # save() tidak menimpa, ia mengganti nama
        default_storage.save(name, ContentFile(data))


def _document_answer(rng, index, student, assignment, session, paragraphs) -> Answer:
    persona, nim = STUDENTS[index], nim_for(index)
    document_id = _id(f"document:{assignment.id}:{index}")
    doc_text = f"{session.title}\n\n{persona.name}\nNIM {nim}\n\n" + "\n\n".join(paragraphs)
    _store_pdf(student, document_id, doc_text)
    note = f"{persona.name} - {nim}. Laporan lengkap ada di PDF terlampir."
    rich = clean_rich_doc({"type": "doc", "content": [_paragraph(note)]})
    return Answer(combine_with_document(note, doc_text), rich, document_id, rng.randint(60, 240), None)


def _typed_answer(rng, index, course, number, session, paragraphs, first_at, latest) -> Answer:
    persona = STUDENTS[index]
    rich = _typed_doc(index, course, number, session, paragraphs)
    duration = rng.randint(persona.minutes[0] * 60, persona.minutes[1] * 60)
    revised_at = None
    if persona.revises and rng.random() < 0.35:
        revised_at = first_at + timedelta(hours=rng.randint(2, 20))
        if revised_at >= latest:
            revised_at = None
    return Answer(rich_to_plain(rich), rich, None, duration, revised_at)


def _grade(rng: random.Random, course: Course, number: int, depth: int) -> tuple[int | None, str]:
    graded = number <= course.graded_through or (number in course.partially_graded and rng.random() < 0.5)
    if not graded:
        return None, ""
    grade = max(50, min(98, GRADE_BY_DEPTH[depth] + rng.randint(-6, 6)))
    return grade, "" if rng.random() < 0.2 else rng.choice(FEEDBACK[depth])


def _simulate_typing(rng: random.Random, style: str, words_total: int, duration: int) -> list[ProgressSample]:
    """Jumlah kata tiap 30 detik, meniru rekaman draf di produksi."""
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


def _events(submission, started_at, first_at, revised_at, samples) -> list[ReasoningEvent]:
    """Event berbentuk sama dengan yang ditulis jalur pengumpulan produksi."""
    sid = submission.id

    def event(key, kind, at, payload=None):
        return ReasoningEvent(
            id=_id(f"event:{sid}:{key}"), submission=submission, event_type=kind, payload=payload or {}, occurred_at=at
        )

    rows = [event("started", EventType.STARTED, started_at), event("submitted", EventType.SUBMITTED, first_at)]
    rows += [
        event(f"progress:{i}", EventType.PROGRESS, started_at + timedelta(seconds=s.offset_seconds), {"word_count": s.word_count})
        for i, s in enumerate(samples)
    ]
    if revised_at is not None:
        rows.append(event("revision:1", EventType.REVISION, revised_at, {"revision_count": 1}))
    return rows


def _analyze(submission: Submission, answer: Answer, samples: list[ProgressSample]) -> None:
    """Skor dari pipeline heuristik produksi; jawaban dokumen tanpa forensik proses."""
    text = answer.text
    process = None if answer.document_id else ProcessContext(
        duration_seconds=answer.duration,
        revision_count=submission.revision_count,
        word_count=len(text.split()),
        char_count=len(text),
        progress=tuple(samples),
    )
    analysis = analyze_text(text, submission.assignment.expected_bloom_level, process)
    assessment = assess_process(process)
    analysis.update(
        process_band=assessment.band, process_evidence=assessment.evidence, analysis_source=AnalysisSource.SEED
    )
    AnalysisResult.objects.update_or_create(submission=submission, defaults=analysis)


def _seed_submission(index, student, course, number, session, assignment) -> tuple[uuid.UUID, list[ReasoningEvent]] | None:
    persona = STUDENTS[index]
    rng = random.Random(f"submission:{index}:{course.label}:{number}")
    if not _submits(rng, index, persona, course, number):
        return None

    paragraphs, depth = _paragraphs(index, course, number, session)
    latest = min(_deadline(course, number), timezone.now()) - timedelta(minutes=30)
    earliest = _published_at(course, number) + timedelta(hours=2)
    first_at = latest - (latest - earliest) * rng.random() ** 2
    if session.kind == "dokumen" and rng.random() < persona.doc_pref:
        answer = _document_answer(rng, index, student, assignment, session, paragraphs)
    else:
        answer = _typed_answer(rng, index, course, number, session, paragraphs, first_at, latest)
    grade, feedback = _grade(rng, course, number, depth)

    started_at = first_at - timedelta(seconds=answer.duration)
    submission, _ = Submission.objects.update_or_create(
        id=_id(f"submission:{assignment.id}:{index}"),
        defaults={
            "assignment": assignment,
            "student_profile": student,
            "text_answer": answer.text,
            "rich_answer": answer.rich,
            "source_document": answer.document_id,
            "started_at": started_at,
            "submitted_at": answer.revised_at or first_at,
            "duration_seconds": answer.duration,
            "revision_count": 1 if answer.revised_at else 0,
            "status": SubmissionStatus.REVIEWED if grade is not None else SubmissionStatus.SUBMITTED,
            "grade": grade,
            "teacher_feedback": feedback,
            "analysis_state": AnalysisState.DONE,
        },
    )
    # Jawaban dokumen tidak punya jejak mengetik, persis seperti di produksi.
    samples = [] if answer.document_id else _simulate_typing(rng, persona.style, len(answer.text.split()), answer.duration)
    _analyze(submission, answer, samples)
    return submission.id, _events(submission, started_at, first_at, answer.revised_at, samples)


def _seed_submissions(course, number, session, assignment, students) -> list[uuid.UUID]:
    kept, events = [], []
    for index, student in enumerate(students):
        seeded = _seed_submission(index, student, course, number, session, assignment)
        if seeded:
            kept.append(seeded[0])
            events += seeded[1]
    # Jawaban di luar seed (mis. latihan demo) dibuang supaya tugas kembali ke keadaan awal.
    Submission.objects.filter(assignment=assignment).exclude(id__in=kept).delete()
    ReasoningEvent.objects.filter(submission_id__in=kept).delete()
    ReasoningEvent.objects.bulk_create(events, batch_size=2000)
    return kept


# --- notifikasi ---------------------------------------------------------------------------
# Lewat fungsi peristiwa produksi, lalu waktunya disetel ke saat peristiwa terjadi.


def _notify_latest_submissions(assignments: list[Assignment], mine) -> None:
    """Dosen: pengumpulan tugas yang terakhir lewat tenggat di tiap kelas."""
    now = timezone.now()
    latest: dict = {}
    for assignment in assignments:
        current = latest.get(assignment.class_ref_id)
        if assignment.deadline < now and (current is None or assignment.deadline > current.deadline):
            latest[assignment.class_ref_id] = assignment
    for assignment in latest.values():
        rows = list(assignment.submissions.select_related("student_profile", "assignment__class_ref").order_by("submitted_at"))
        for submission in rows:
            notify_events.submission_received(submission, revised=False)
        if rows:
            mine.filter(group_key=f"submissions:{assignment.id}").update(created_at=rows[-1].submitted_at)


def _notify_open_work(assignments: list[Assignment], materials: list[Material], mine) -> None:
    """Mahasiswa: tugas yang masih berjalan dan materi terbaru tiap kelas."""
    now = timezone.now()
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


def _notify_latest_grades(students: list[Profile], mine) -> None:
    """Nilai terbaru tiap mahasiswa, sudah lama dan sudah dibaca."""
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


def _notify_open_cekpaham(students: list[Profile], mine) -> None:
    now = timezone.now()
    pending = CekPaham.objects.filter(
        status=RequestStatus.ACTIVE, window_end__gt=now, attempts__isnull=True, submission__student_profile__in=students
    ).select_related("submission__assignment__class_ref")
    for cekpaham in pending:
        notify_events.cekpaham_created(cekpaham)
    mine.filter(kind=NotificationKind.CEKPAHAM_NEW).update(created_at=now - timedelta(hours=3))


def _seed_notifications(teachers, students, assignments, materials) -> int:
    profiles = [*teachers, *students]
    Notification.objects.filter(recipient__in=profiles).delete()
    mine = Notification.objects.filter(recipient__in=profiles)
    _notify_latest_submissions(assignments, mine)
    _notify_open_work(assignments, materials, mine)
    _notify_latest_grades(students, mine)
    _notify_open_cekpaham(students, mine)
    return mine.count()


class Command(BaseCommand):
    help = "Seed data demo: 2 dosen, 20 mahasiswa, 4 kelas di tengah semester (idempoten)."

    def handle(self, *args, **options):
        with transaction.atomic():
            Class.objects.filter(id__in=[_id(f"class:{label}") for label in LEGACY_CLASSES]).delete()
            teachers, students = _seed_accounts()
            SubmissionDraft.objects.filter(student_profile__in=students).delete()  # draf latihan demo

            classes: dict[str, Class] = {}
            assignments: dict[tuple[str, int], Assignment] = {}
            materials: list[Material] = []
            submission_count = 0
            for course in COURSES:
                klass = classes[course.label] = _seed_class(course, teachers[course.teacher], students)
                for number, session in enumerate(course.sessions, start=1):
                    assignment = assignments[(course.label, number)] = _seed_assignment(course, klass, number, session)
                    materials.append(_seed_material(course, klass, number, session))
                    submission_count += len(_seed_submissions(course, number, session, assignment, students))

            cekpaham_count = seed_cekpaham_demo(teachers["budi"], students, assignments[CEKPAHAM_TASK])
            forum_count = seed_forum_demo(classes, students)
            seed_todos_demo(students[DEMO_STUDENT])
            notification_count = _seed_notifications(
                list(teachers.values()), students, list(assignments.values()), materials
            )

        quick = assignments[QUICK_TASK]
        self.stdout.write(
            f"Seeded classes={len(classes)}, assignments={len(assignments)}, materials={len(materials)}, "
            f"submissions={submission_count}, cekpaham={cekpaham_count}, forum_posts={forum_count}, "
            f"notifications={notification_count}"
        )
        self.stdout.write(
            f"Akun demo (password {SEED_PASSWORD}): {TEACHERS['budi'][0]} (3 kelas), "
            f"{TEACHERS['hendra'][0]} (Business Creation), mhs01..mhs{len(STUDENTS):02d}@thinkpath.local.\n"
            f"Demo mhs01: kerjakan '{quick.title}' di {classes[QUICK_TASK[0]].name} "
            f"(tenggat {quick.deadline:%Y-%m-%d %H:%M %Z}), lalu buka Cek Paham yang terbuka."
        )
