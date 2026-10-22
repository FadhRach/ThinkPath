"""Alur satu sesi menjawab: mulai, caption live, finalisasi, dan proses ulang.

Finalisasi sinkron di dalam request (pola run_analysis): STT lalu penilai dijalankan
DI LUAR transaksi supaya tidak ada baris terkunci selama menunggu API. Kasus
terburuk ~50 detik, di bawah timeout gunicorn 60 detik.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from uuid import UUID

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.cekpaham import judge
from apps.cekpaham.models import AttemptStatus, CekPaham, CekPahamAttempt
from apps.cekpaham.providers import groq_stt
from apps.cekpaham.selectors import live_attempt, phase_of
from apps.cekpaham.services import audio
from apps.cekpaham.services.gate import require_cekpaham_consent

# Finalisasi diterima sampai tenggat + ini; lewat itu sesi dianggap terputus.
FINALIZE_GRACE = timedelta(seconds=10)
# Durasi ucapan melebihi batas + ini diberi flag over_time (tidak dipotong diam-diam).
OVER_TIME_SECONDS = 15
# Pemrosesan yang macet (proses mati di tengah) boleh diulang dosen setelah ini.
STALE_PROCESSING = timedelta(seconds=120)
LIVE_TRANSCRIPT_MAX = 6000
EVENT_KEYS = ("visibility_changes", "blur_count", "device_changes", "mic_errors", "silent_seconds")
EVENT_REASON_MAX = 40

PHASE_MESSAGES = {
    "upcoming": "Cek Paham ini belum dibuka. Cek waktu pengerjaannya.",
    "closed": "Waktu pengerjaan Cek Paham ini sudah ditutup. Hubungi dosenmu bila ada kendala.",
    "cancelled": "Cek Paham ini sudah dibatalkan dosen.",
}
SESSION_STARTED = "Kamu sudah memulai Cek Paham ini. Bila mengalami kendala, laporkan ke dosen."

logger = logging.getLogger(__name__)


def expire_stale(cekpaham: CekPaham) -> None:
    """Sesi yang tenggatnya lewat tanpa finalisasi (tab ditutup) menjadi terputus."""
    CekPahamAttempt.objects.filter(
        cekpaham=cekpaham,
        status=AttemptStatus.IN_PROGRESS,
        deadline_at__lt=timezone.now() - FINALIZE_GRACE,
    ).update(status=AttemptStatus.INTERRUPTED, finalized_at=timezone.now())


def start_attempt(cekpaham: CekPaham, student_id: UUID) -> CekPahamAttempt:
    require_cekpaham_consent(student_id)
    now = timezone.now()
    with transaction.atomic():
        locked = CekPaham.objects.select_for_update().get(pk=cekpaham.pk)
        expire_stale(locked)
        phase = phase_of(locked, now)
        if phase != "open":
            raise ValidationError(PHASE_MESSAGES[phase])
        if live_attempt(locked) is not None:
            raise ValidationError(SESSION_STARTED)
        number = (locked.attempts.aggregate(top=Max("number"))["top"] or 0) + 1
        return CekPahamAttempt.objects.create(
            cekpaham=locked,
            number=number,
            started_at=now,
            deadline_at=now + timedelta(seconds=locked.answer_seconds),
        )


def validate_audio(data: bytes, content_type: str | None, max_bytes: int) -> str:
    mime = audio.base_mime(content_type)
    if mime not in audio.EXTENSIONS:
        raise ValidationError({"audio": "Format audio tidak didukung."})
    if not data:
        raise ValidationError({"audio": "Audio kosong."})
    if len(data) > max_bytes:
        raise ValidationError({"audio": f"Audio maksimal {max_bytes // (1024 * 1024)} MB."})
    return mime


def transcribe_live(
    cekpaham: CekPaham, student_id: UUID, data: bytes, content_type: str | None, purpose: str
) -> dict:
    """Caption sementara dari satu potongan. Best-effort: gagal bukan galat bagi pemanggil."""
    require_cekpaham_consent(student_id)
    mime = validate_audio(data, content_type, audio.MAX_LIVE_CHUNK_BYTES)
    now = timezone.now()
    if purpose == "answer":
        attempt = live_attempt(cekpaham)
        if attempt is None or attempt.status != AttemptStatus.IN_PROGRESS or now > attempt.deadline_at + FINALIZE_GRACE:
            raise ValidationError("Tidak ada sesi yang sedang berjalan.")
    else:
        phase = phase_of(cekpaham, now)
        if phase != "open":
            raise ValidationError(PHASE_MESSAGES[phase])
    result = groq_stt.transcribe(
        data, mime, cekpaham.language, budget_s=groq_stt.LIVE_BUDGET_SECONDS, retries=0
    )
    return {"ok": result.ok, "text": result.text, "error": result.error_code}


def clean_events(raw: object) -> dict:
    """Konteks dari klien: hanya kunci dikenal dengan angka wajar. Tidak pernah diskor."""
    if not isinstance(raw, dict):
        return {}
    events = {
        key: min(max(int(raw[key]), 0), 100_000)
        for key in EVENT_KEYS
        if isinstance(raw.get(key), (int, float)) and not isinstance(raw.get(key), bool)
    }
    if isinstance(raw.get("ended_reason"), str):
        events["ended_reason"] = raw["ended_reason"][:EVENT_REASON_MAX]
    return events


def finalize_attempt(
    cekpaham: CekPaham,
    student_id: UUID,
    *,
    data: bytes | None,
    content_type: str | None,
    live_transcript: str,
    client_events: object,
    interrupted: bool,
) -> tuple[CekPahamAttempt, bool]:
    """(attempt, baru): baru False untuk panggilan ulang yang hanya mengembalikan hasil lama."""
    require_cekpaham_consent(student_id)
    mime = ""
    if data is not None:
        mime = validate_audio(data, content_type, audio.MAX_AUDIO_BYTES)
    elif not interrupted:
        raise ValidationError({"audio": "Audio jawaban tidak ditemukan."})

    now = timezone.now()
    with transaction.atomic():
        attempt = (
            CekPahamAttempt.objects.select_for_update()
            .filter(cekpaham=cekpaham)
            .exclude(status=AttemptStatus.VOIDED)
            .first()
        )
        if attempt is None:
            raise ValidationError("Sesi belum dimulai.")
        if attempt.status != AttemptStatus.IN_PROGRESS:
            return attempt, False  # idempoten: panggilan ulang mengembalikan hasil yang sama
        late = now > attempt.deadline_at + FINALIZE_GRACE
        attempt.status = AttemptStatus.INTERRUPTED if (interrupted or late) else AttemptStatus.PROCESSING
        attempt.finalized_at = now
        attempt.client_events = clean_events(client_events)
        attempt.live_transcript = (live_transcript or "")[:LIVE_TRANSCRIPT_MAX]
        attempt.save()

    if data is not None:
        attempt.audio_path = audio.store(student_id, attempt.id, data, mime)
        attempt.audio_mime, attempt.audio_bytes = mime, len(data)
        attempt.save(update_fields=["audio_path", "audio_mime", "audio_bytes"])
    if attempt.status == AttemptStatus.PROCESSING:
        process_attempt(attempt)
    return attempt, True


def _fail(attempt: CekPahamAttempt, code: str) -> CekPahamAttempt:
    attempt.status = AttemptStatus.PROCESSING_FAILED
    attempt.error_code = code
    attempt.save()
    return attempt


def process_attempt(attempt: CekPahamAttempt) -> CekPahamAttempt:
    """STT lalu penilai. Tidak melempar: kegagalan menjadi processing_failed dengan error_code."""
    try:
        return _process(attempt)
    except Exception:  # noqa: BLE001 - sesi yang sudah direkam tidak boleh hilang karena galat tak terduga
        logger.exception("Pemrosesan Cek Paham gagal tak terduga (attempt %s)", attempt.id)
        return _fail(attempt, "internal_error")


def _apply_transcription(attempt: CekPahamAttempt, transcription: groq_stt.Transcription) -> None:
    attempt.final_transcript = transcription.text
    attempt.transcript_source = attempt.asr_provider = "groq"
    attempt.asr_model = groq_stt.STT_MODEL
    attempt.asr_quality = transcription.quality()
    attempt.audio_duration_s = transcription.duration_s
    attempt.first_speech_offset_s = transcription.first_speech_offset_s


def _apply_verdict(attempt: CekPahamAttempt, verdict: judge.JudgeResult) -> None:
    flags = list(verdict.flags)
    if attempt.audio_duration_s and attempt.audio_duration_s > attempt.cekpaham.answer_seconds + OVER_TIME_SECONDS:
        flags.append("over_time")
    attempt.ai_score = verdict.score
    attempt.ai_band = verdict.band
    attempt.ai_dimensions = verdict.dimensions
    attempt.ai_flags = flags
    attempt.ai_summary = verdict.summary
    attempt.judge_model = verdict.model
    attempt.rubric_version, attempt.prompt_version = judge.rubric.RUBRIC_VERSION, judge.rubric.PROMPT_VERSION
    attempt.judge_runs = verdict.runs
    attempt.error_code = ""
    attempt.status = AttemptStatus.SCORED


def _process(attempt: CekPahamAttempt) -> CekPahamAttempt:
    cekpaham = attempt.cekpaham
    submission = cekpaham.submission
    # Transkrip sudah ada dan hanya penilai yang gagal: ulangi penilai saja.
    judge_only = bool(attempt.final_transcript) and attempt.error_code.startswith("judge_")

    if judge_only:
        no_speech, unsure = False, attempt.asr_quality.get("unsure", [])
    else:
        if not attempt.audio_path:
            return _fail(attempt, "no_audio")
        with default_storage.open(attempt.audio_path) as stored:
            data = stored.read()
        transcription = groq_stt.transcribe(
            data, attempt.audio_mime, cekpaham.language, keyterms=cekpaham.keyterms
        )
        if not transcription.ok:
            return _fail(attempt, transcription.error_code)
        _apply_transcription(attempt, transcription)
        no_speech, unsure = transcription.no_speech, transcription.unsure_text

    verdict = judge.judge(
        judge.JudgeInput(
            question=cekpaham.question_text,
            assignment_title=submission.assignment.title,
            assignment_prompt=submission.assignment.instructions,
            main_answer=submission.text_answer,
            transcript=attempt.final_transcript,
            language=cekpaham.language,
            answer_seconds=cekpaham.answer_seconds,
            no_speech=no_speech,
            unsure_text=unsure,
        )
    )
    if verdict.error_code:
        return _fail(attempt, verdict.error_code)
    _apply_verdict(attempt, verdict)
    attempt.save()
    return attempt


def reprocess_attempt(attempt: CekPahamAttempt) -> CekPahamAttempt:
    """Dosen mengulang STT + penilai dari audio tersimpan (atau penilai saja bila transkrip sudah ada)."""
    now = timezone.now()
    with transaction.atomic():
        attempt = CekPahamAttempt.objects.select_for_update().select_related(
            "cekpaham__submission__assignment"
        ).get(pk=attempt.pk)
        stuck = (
            attempt.status == AttemptStatus.PROCESSING
            and attempt.finalized_at is not None
            and now - attempt.finalized_at > STALE_PROCESSING
        )
        allowed = attempt.status in (AttemptStatus.PROCESSING_FAILED, AttemptStatus.INTERRUPTED) or stuck
        if not allowed:
            raise ValidationError("Sesi ini tidak perlu diproses ulang.")
        if not attempt.audio_path and not attempt.final_transcript:
            raise ValidationError("Tidak ada audio tersimpan untuk diproses ulang.")
        attempt.status = AttemptStatus.PROCESSING
        attempt.finalized_at = now
        attempt.save(update_fields=["status", "finalized_at"])
    return process_attempt(attempt)
