"""Data demo Cek Paham untuk `seed_demo_data` (idempoten lewat uuid5).

Tiga keadaan supaya seluruh alur bisa didemokan tanpa mikrofon sungguhan:
- terbuka untuk mhs07 (mhs07 sudah menyetujui rekaman suara, jadi bisa langsung mencoba);
- sudah dinilai, dengan transkrip fixture (mhs08);
- sudah dinilai dan ada laporan terbuka "transkrip tidak sesuai" (mhs06).

Tidak ada audio asli. Transkrip dan penilaian adalah fixture, ditandai [DATA DEMO].
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Sequence

from django.utils import timezone

from apps.academics.models import Submission
from apps.accounts.models import ConsentAction, Profile, Role
from apps.accounts.privacy import (
    ITEM_EXTERNAL_AI,
    ITEM_VOICE_CEKPAHAM,
    REQUIRED_ITEMS,
    current_consent,
    record_consent,
)
from apps.cekpaham import rubric
from apps.cekpaham.models import (
    AttemptStatus,
    CekPaham,
    CekPahamAttempt,
    CekPahamReport,
    ReportReason,
    ReportStatus,
)

NAMESPACE = uuid.UUID("3b1c0f5e-6a0d-4c46-9a52-0b9d5a1c7e21")
DEMO_NOTE = "[DATA DEMO] "
QUESTION = "Pada jawabanmu kamu memilih satu pendekatan. Jelaskan alasannya dan bagaimana kamu mengumpulkan datanya."
TRANSCRIPT = (
    "Saya memilih pendekatan kualitatif karena yang saya teliti itu pengalaman mahasiswa, bukan angka. "
    "Waktu pengambilan data saya wawancara lima orang, lalu dari situ saya kelompokkan jawabannya jadi tiga tema."
)
LEVELS = {"accuracy": 3, "consistency": 2, "depth": 2, "ownership": 3}
EVIDENCE = {
    "accuracy": "pendekatan kualitatif karena yang saya teliti itu pengalaman mahasiswa",
    "consistency": "wawancara lima orang",
    "depth": "saya kelompokkan jawabannya jadi tiga tema",
    "ownership": "Waktu pengambilan data saya wawancara lima orang",
}


def _id(label: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, label)


def _submission_of(student: Profile, skip: set[uuid.UUID]) -> Submission | None:
    return (
        Submission.objects.filter(student_profile=student)
        .exclude(pk__in=skip)
        .select_related("assignment")
        .order_by("-submitted_at")
        .first()
    )


def _request(label, submission, teacher, *, window, status="active") -> CekPaham:
    start, end = window
    obj, _ = CekPaham.objects.update_or_create(
        pk=_id(label),
        defaults=dict(
            submission=submission, created_by=teacher, question_text=QUESTION, language="id",
            answer_seconds=45, window_start=start, window_end=end, status=status,
            keyterms=["kualitatif", "wawancara", "tema"],
        ),
    )
    return obj


def _scored_attempt(label, cekpaham, *, started) -> CekPahamAttempt:
    score = rubric.score_from_levels(LEVELS)
    dimensions = {
        name: {"level": level, "evidence": [EVIDENCE[name]], "reason": f"{DEMO_NOTE}Ringkas dan sesuai jawaban tertulis."}
        for name, level in LEVELS.items()
    }
    attempt, _ = CekPahamAttempt.objects.update_or_create(
        pk=_id(label),
        defaults=dict(
            cekpaham=cekpaham, number=1, status=AttemptStatus.SCORED, started_at=started,
            deadline_at=started + timedelta(seconds=45), finalized_at=started + timedelta(seconds=52),
            live_transcript=TRANSCRIPT, final_transcript=TRANSCRIPT, transcript_source="seed",
            asr_provider="seed", asr_model="data-demo", audio_duration_s=31.0, first_speech_offset_s=1.8,
            asr_quality={"segments": [], "dropped": [], "unsure": []},
            client_events={"visibility_changes": 0, "blur_count": 1, "device_changes": 0, "mic_errors": 0, "silent_seconds": 4},
            ai_score=score, ai_band=rubric.band_from_score(score), ai_dimensions=dimensions, ai_flags=[],
            ai_summary=f"{DEMO_NOTE}Menyebut pilihan pendekatan beserta alasannya dan menceritakan proses pengambilan datanya sendiri.",
            judge_model="data-demo", rubric_version=rubric.RUBRIC_VERSION, prompt_version=rubric.PROMPT_VERSION,
            judge_runs=[{"order": "normal", "score": score}, {"order": "reversed", "score": score}],
        ),
    )
    return attempt


def seed_cekpaham_demo(teacher: Profile, students: Sequence[Profile]) -> int:
    if len(students) < 8:
        return 0
    now = timezone.now()
    used: set[uuid.UUID] = set()

    # Akun demo yang menjalani alur nyata sudah menyetujui rekaman suara; akun lain
    # melihat kotak info "izin rekaman suara belum aktif" saat pertama mencoba.
    demo_student = students[6]
    if current_consent(demo_student.id) is None:
        record_consent(
            demo_student.id,
            ConsentAction.GIVEN,
            [*REQUIRED_ITEMS[Role.STUDENT], ITEM_EXTERNAL_AI, ITEM_VOICE_CEKPAHAM],
        )

    count = 0
    plans = [
        ("open", students[6], dict(window=(now - timedelta(hours=1), now + timedelta(days=3)))),
        ("scored", students[7], dict(window=(now - timedelta(days=2), now + timedelta(days=1)))),
        ("reported", students[5], dict(window=(now - timedelta(days=2), now + timedelta(days=1)))),
    ]
    for label, student, options in plans:
        submission = _submission_of(student, used)
        if submission is None:
            continue
        used.add(submission.pk)
        cekpaham = _request(f"cp-{label}", submission, teacher, **options)
        count += 1
        if label == "open":
            continue
        attempt = _scored_attempt(f"cp-{label}-attempt", cekpaham, started=now - timedelta(hours=5))
        if label == "reported":
            CekPahamReport.objects.update_or_create(
                pk=_id("cp-reported-report"),
                defaults=dict(
                    attempt=attempt, reason=ReportReason.TRANSCRIPT_MISMATCH, status=ReportStatus.OPEN,
                    note=f"{DEMO_NOTE}Saya bilang 'tiga tema', tetapi di transkrip tertulis 'tiga tim'.",
                    resolved_at=None, resolved_by=None, response_note="",
                ),
            )
    return count
