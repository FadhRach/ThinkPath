"""Klien Groq untuk mengubah suara menjadi teks (Whisper).

Kontraknya: tidak pernah melempar ke pemanggil. Semua kegagalan dipetakan ke
error_code supaya service bisa menyimpan audio dan menawarkan proses ulang,
bukan mengembalikan 500 ke mahasiswa yang baru selesai menjawab.

Whisper mengarang kalimat pada audio hening ("Terima kasih."), dan angka
kepercayaan per segmen TIDAK menangkapnya: pada klip hening 6 detik yang diuji
Oktober 2026, no_speech_prob = 0 dan avg_logprob = -0,12. Yang membedakan adalah
segmennya berakhir di detik 29,98 padahal audio hanya 6 detik. Karena itu
filter_segments() memeriksa batas waktu dan daftar frasa, bukan hanya angka.
"""
from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass, field

import requests

STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
STT_MODEL = "whisper-large-v3-turbo"
# Total waktu untuk satu transkripsi, termasuk percobaan ulang. Finalisasi
# (STT + penilai) harus tetap di bawah timeout gunicorn 60 detik.
FINAL_BUDGET_SECONDS = 25
LIVE_BUDGET_SECONDS = 8
RETRY_BACKOFF_SECONDS = 1.5
MAX_BACKOFF_SECONDS = 3
# Prompt Whisper dibatasi sekitar 224 token.
PROMPT_MAX_CHARS = 400

NO_SPEECH_PROB = 0.6
LOW_LOGPROB = -1.0
MAX_COMPRESSION_RATIO = 2.4
# Segmen yang berakhir lebih jauh dari ini setelah audio habis dianggap karangan.
OVERRUN_TOLERANCE_SECONDS = 1.0
# Segmen dengan avg_logprob di bawah ini diteruskan ke penilai sebagai "ragu".
UNSURE_LOGPROB = -0.8

# Frasa penutup yang sering dikarang Whisper pada audio hening.
HALLUCINATED_PHRASES = frozenset(
    {
        "terima kasih",
        "terima kasih telah menonton",
        "terima kasih sudah menonton",
        "sampai jumpa",
        "sampai jumpa di video berikutnya",
        "jangan lupa subscribe",
        "like dan subscribe",
        "thank you",
        "thanks for watching",
        "thank you for watching",
        "bye",
    }
)
SUBTITLE_CREDIT = re.compile(r"^(subtitles?|captions?) by\b")

EXTENSIONS = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3"}
# Batas per jam atau per hari tidak pulih dalam hitungan detik; jangan diulang.
QUOTA_PATTERN = re.compile(r"per (day|hour)|\b(rpd|tpd|asd|ash)\b")


@dataclass(frozen=True)
class Transcription:
    text: str = ""
    duration_s: float | None = None
    kept: list[dict] = field(default_factory=list)
    dropped: list[dict] = field(default_factory=list)
    error_code: str = ""

    @property
    def ok(self) -> bool:
        return not self.error_code

    @property
    def no_speech(self) -> bool:
        return self.ok and not self.text

    @property
    def first_speech_offset_s(self) -> float | None:
        return self.kept[0]["start"] if self.kept else None

    @property
    def unsure_text(self) -> list[str]:
        return [s["text"] for s in self.kept if (s["avg_logprob"] or 0) < UNSURE_LOGPROB]

    def quality(self) -> dict:
        """Ringkasan untuk disimpan dan ditampilkan ke dosen."""
        return {"segments": self.kept, "dropped": self.dropped, "unsure": self.unsure_text}


def is_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def _phrase(text: str) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", text.lower()).split())


def filter_segments(segments: list[dict], duration: float | None) -> tuple[list[dict], list[dict]]:
    """Pisahkan segmen ucapan nyata dari karangan Whisper. Fungsi murni."""
    kept, dropped = [], []
    for segment in segments:
        phrase = _phrase(segment["text"])
        logprob, no_speech, ratio = (
            segment["avg_logprob"],
            segment["no_speech_prob"],
            segment["compression_ratio"],
        )
        if not phrase:
            reason = "empty"
        elif no_speech is not None and logprob is not None and no_speech > NO_SPEECH_PROB and logprob < LOW_LOGPROB:
            reason = "no_speech"
        elif ratio is not None and ratio > MAX_COMPRESSION_RATIO:
            reason = "repetitive"
        elif duration is not None and (
            segment["start"] >= duration or segment["end"] > duration + OVERRUN_TOLERANCE_SECONDS
        ):
            reason = "beyond_audio"
        elif phrase in HALLUCINATED_PHRASES or SUBTITLE_CREDIT.match(phrase):
            reason = "known_phrase"
        else:
            kept.append(segment)
            continue
        dropped.append({"text": segment["text"], "reason": reason})
    return kept, dropped


def _segment(raw: dict) -> dict:
    def number(key: str) -> float | None:
        value = raw.get(key)
        return float(value) if isinstance(value, (int, float)) else None

    return {
        "start": number("start") or 0.0,
        "end": number("end") or 0.0,
        "text": str(raw.get("text", "")).strip(),
        "avg_logprob": number("avg_logprob"),
        "no_speech_prob": number("no_speech_prob"),
        "compression_ratio": number("compression_ratio"),
    }


def _parse(body: dict) -> Transcription:
    if not isinstance(body, dict):
        raise ValueError("Respons STT bukan objek JSON.")
    duration = body.get("duration")
    duration = float(duration) if isinstance(duration, (int, float)) else None
    raw_segments = body.get("segments")
    if not isinstance(raw_segments, list):
        raw_segments = []
    if not raw_segments and str(body.get("text", "")).strip():
        # Tanpa rincian segmen tidak ada angka kepercayaan, tetapi teksnya tetap dipakai.
        raw_segments = [{"start": 0, "end": duration or 0, "text": body["text"]}]
    kept, dropped = filter_segments([_segment(s) for s in raw_segments if isinstance(s, dict)], duration)
    return Transcription(
        text=" ".join(s["text"] for s in kept),
        duration_s=duration,
        kept=kept,
        dropped=dropped,
    )


def transcribe(
    audio: bytes,
    mime: str,
    language: str,
    *,
    keyterms: list[str] | tuple[str, ...] = (),
    budget_s: float = FINAL_BUDGET_SECONDS,
    retries: int = 1,
    model: str = STT_MODEL,
) -> Transcription:
    """`model` hanya diganti oleh ai_experiment untuk membandingkan model; produksi memakai STT_MODEL."""
    if not is_configured():
        return Transcription(error_code="stt_not_configured")
    data = {
        "model": model,
        "response_format": "verbose_json",
        "temperature": "0",
        "language": language,
    }
    if keyterms:
        data["prompt"] = ", ".join(keyterms)[:PROMPT_MAX_CHARS]
    filename = f"audio.{EXTENSIONS.get(mime, 'webm')}"
    headers = {"Authorization": f"Bearer {os.getenv('GROQ_API_KEY', '').strip()}"}

    deadline = time.monotonic() + budget_s
    error = "stt_unavailable"
    for attempt in range(retries + 1):
        remaining = deadline - time.monotonic()
        if remaining < 1:
            break
        try:
            response = requests.post(
                STT_URL,
                headers=headers,
                data=data,
                files={"file": (filename, audio, mime)},
                timeout=remaining,
            )
        except requests.Timeout:
            return Transcription(error_code="stt_timeout")
        except requests.RequestException:
            error = "stt_unavailable"
        else:
            status = response.status_code
            if status == 200:
                try:
                    return _parse(response.json())
                except (ValueError, TypeError, KeyError):
                    return Transcription(error_code="stt_bad_response")
            if status in (401, 403):
                return Transcription(error_code="stt_auth")
            if status in (400, 413, 415, 422):
                return Transcription(error_code="stt_bad_audio")
            if status == 429:
                if QUOTA_PATTERN.search(response.text.lower()):
                    return Transcription(error_code="stt_quota")
                error = "stt_rate_limited"
            else:
                error = "stt_unavailable"
        if attempt < retries:
            time.sleep(min(RETRY_BACKOFF_SECONDS * 2**attempt, MAX_BACKOFF_SECONDS))
    return Transcription(error_code=error)
