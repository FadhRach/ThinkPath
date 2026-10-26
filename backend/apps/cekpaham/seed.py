"""Data demo Cek Paham untuk `seed_demo_data` (idempoten lewat uuid5).

Tiga keadaan pada satu tugas (Linear search vs binary search), supaya seluruh alur bisa
didemokan tanpa mikrofon sungguhan:
- terbuka untuk mhs07 (semua akun demo sudah menyetujui kebijakan, jadi bisa langsung mencoba);
- sudah dinilai, dengan transkrip fixture (mhs08);
- sudah dinilai dan ada laporan terbuka "transkrip tidak sesuai" (mhs06).

Tidak ada audio asli. Transkrip dan penilaian adalah fixture, ditandai [DATA DEMO].
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Sequence

from django.utils import timezone

from apps.academics.models import Assignment, Submission
from apps.accounts.models import Profile
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
QUESTION = "Di jawabanmu kamu memilih binary search. Jelaskan kenapa, dan bagaimana kamu menguji bahwa hasilnya benar."
TRANSCRIPT = (
    "Saya pilih binary search karena datanya sudah urut berdasarkan NIM, jadi setiap langkah separuh data langsung dibuang. "
    "Untuk mengujinya saya coba cari NIM yang ada di awal, di tengah, dan NIM yang tidak ada sama sekali."
)
LEVELS = {"accuracy": 3, "consistency": 2, "depth": 2, "ownership": 3}
EVIDENCE = {
    "accuracy": "datanya sudah urut berdasarkan NIM",
    "consistency": "setiap langkah separuh data langsung dibuang",
    "depth": "NIM yang tidak ada sama sekali",
    "ownership": "Untuk mengujinya saya coba cari NIM yang ada di awal",
}

def _id(label: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, label)


def _request(label, submission, teacher, *, window, status="active") -> CekPaham:
    start, end = window
    obj, _ = CekPaham.objects.update_or_create(
        pk=_id(label),
        defaults=dict(
            submission=submission, created_by=teacher, question_text=QUESTION, language="id",
            answer_seconds=45, window_start=start, window_end=end, status=status,
            keyterms=["binary search", "urut", "separuh"],
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
            ai_summary=f"{DEMO_NOTE}Menjelaskan syarat data urut, cara kerja binary search, dan kasus uji yang ia coba sendiri.",
            judge_model="data-demo", rubric_version=rubric.RUBRIC_VERSION, prompt_version=rubric.PROMPT_VERSION,
            judge_runs=[{"order": "normal", "score": score}, {"order": "reversed", "score": score}],
        ),
    )
    return attempt


def seed_cekpaham_demo(teacher: Profile, students: Sequence[Profile], assignment: Assignment) -> int:
    if len(students) < 8:
        return 0
    now = timezone.now()

    count = 0
    plans = [
        ("open", students[6], dict(window=(now - timedelta(hours=1), now + timedelta(days=3)))),
        ("scored", students[7], dict(window=(now - timedelta(days=2), now + timedelta(days=1)))),
        ("reported", students[5], dict(window=(now - timedelta(days=2), now + timedelta(days=1)))),
    ]
    for label, student, options in plans:
        submission = Submission.objects.filter(assignment=assignment, student_profile=student).first()
        if submission is None:
            continue
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
                    note=f"{DEMO_NOTE}Saya bilang 'separuh data', tetapi di transkrip tertulis 'sebagian data'.",
                    resolved_at=None, resolved_by=None, response_note="",
                ),
            )
    return count
