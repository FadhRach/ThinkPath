"""Penyedia ASR yang dibandingkan. Semuanya mengembalikan AsrResult yang sama.

Adapter Groq memanggil `apps.cekpaham.providers.groq_stt.transcribe` milik produksi
(termasuk filter halusinasi), bukan salinannya, supaya angka yang diukur adalah
perilaku yang sungguh berjalan di aplikasi. Hanya modelnya yang diganti.

Deepgram sengaja tidak ada: produk tidak memakainya (keputusan satu penyedia).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

MIME_BY_SUFFIX = {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
}
GROQ_MODELS = {"groq-turbo": "whisper-large-v3-turbo", "groq-large-v3": "whisper-large-v3"}


class QuotaExhausted(Exception):
    """Jatah harian/jam penyedia habis; sisa klip tidak bisa diproses sekarang."""


@dataclass(frozen=True)
class AsrResult:
    text: str  # keluaran seperti yang dipakai produksi (sudah disaring)
    raw_text: str  # sebelum disaring, untuk mengukur halusinasi pada klip hening
    seconds: float
    error: str = ""


class GroqAdapter:
    def __init__(self, name: str) -> None:
        self.name = name
        self.model = GROQ_MODELS[name]

    def transcribe(self, path: Path, language: str, keyterms: list[str]) -> AsrResult:
        from apps.cekpaham.providers import groq_stt  # setelah bootstrap_backend()

        mime = MIME_BY_SUFFIX.get(path.suffix.lower(), "audio/webm")
        started = time.monotonic()
        result = groq_stt.transcribe(
            path.read_bytes(), mime, language, keyterms=keyterms, model=self.model
        )
        elapsed = time.monotonic() - started
        if result.error_code == "stt_quota":
            raise QuotaExhausted(result.error_code)
        raw = " ".join(s["text"] for s in result.kept) + " " + " ".join(d["text"] for d in result.dropped)
        return AsrResult(result.text, raw.strip(), elapsed, result.error_code)


class FasterWhisperAdapter:
    """Whisper `small` int8 di CPU: bukti layak tidaknya self-host di VPS 2 core / 2 GB."""

    name = "faster-whisper-small"

    def __init__(self) -> None:
        self._model = None

    def _load(self):
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover - bergantung lingkungan
            raise SystemExit(
                "faster-whisper belum terpasang. Jalankan: pip install faster-whisper\n"
                "(mengunduh model ±460 MB saat dipakai pertama kali)."
            ) from exc
        return WhisperModel("small", device="cpu", compute_type="int8")

    def transcribe(self, path: Path, language: str, keyterms: list[str]) -> AsrResult:
        self._model = self._model or self._load()
        started = time.monotonic()
        segments, _ = self._model.transcribe(
            _audio_input(path), language=language, temperature=0, initial_prompt=", ".join(keyterms) or None
        )
        text = " ".join(segment.text.strip() for segment in segments)
        return AsrResult(text, text, time.monotonic() - started)


def _audio_input(path: Path):
    """WAV/FLAC 16 kHz dibaca langsung sebagai array.

    Dekoder bawaan faster-whisper (PyAV) tidak cocok dengan sebagian versi PyAV
    terbaru; berkas WAV tidak perlu dekoder itu. Format lain tetap lewat path.
    """
    if path.suffix.lower() in {".wav", ".flac"}:
        import soundfile as sf

        audio, rate = sf.read(path, dtype="float32")
        if rate == 16_000:
            return audio if audio.ndim == 1 else audio.mean(axis=1)
    return str(path)


def build_adapter(name: str):
    if name in GROQ_MODELS:
        return GroqAdapter(name)
    if name == FasterWhisperAdapter.name:
        return FasterWhisperAdapter()
    raise SystemExit(f"Adapter tidak dikenal: {name}. Pilihan: {', '.join([*GROQ_MODELS, FasterWhisperAdapter.name])}")
