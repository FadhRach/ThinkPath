"""Detektor AI eksternal (Winston AI) untuk skor E1 saja; tidak pernah menyentuh level Bloom.

Pemanggil hanya memakai detect(), score_to_band(), PROVIDER_NAME, MODEL_VERSION.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import requests

from apps.analysis.choices import AiBand

logger = logging.getLogger(__name__)

PROVIDER_NAME = "Winston AI"
API_URL = "https://api.gowinston.ai/v2/ai-content-detection"

# Versi dikunci: skor tersimpan harus tetap bisa dijelaskan; mengganti versi = kalibrasi ulang.
MODEL_VERSION = "4.18"

# Eksplisit: deteksi otomatis pada teks campuran Indonesia-Inggris bisa memilih "en".
LANGUAGE = "id"

# Winston 8 s + Groq 12 s tetap jauh di bawah timeout gunicorn 60 s.
REQUEST_TIMEOUT_SECONDS = 8

# Di bawah ini API menolak; tidak dikirim karena kredit ditagih per kata.
MIN_CHARS = 300

# Di bawah ini Winston sendiri menyatakan hasilnya belum andal: tetap dipakai, ditandai tidak andal.
RELIABLE_MIN_CHARS = 600

MAX_CHARS = 150_000

# Ambang band Winston 35/70, milik detektor sendiri: JANGAN pakai ambang heuristik 42/70 di sini
# (sebaran skornya berbeda). Titik awal sementara, belum hasil ukur.
MID_THRESHOLD = 35
HIGH_THRESHOLD = 70


@dataclass(frozen=True)
class DetectorResult:
    """ai_probability SUDAH dibalik: Winston mengembalikan skor MANUSIA (0 = AI, 100 = manusia).

    Pembalikan terjadi tepat sekali di detect(). Terlewat atau ganda, mahasiswa jujur dapat skor AI
    tertinggi dan angkanya tetap tampak wajar.
    """

    ai_probability: float
    reliable: bool
    attack_kinds: tuple[str, ...] = ()

    @property
    def attack_detected(self) -> bool:
        return bool(self.attack_kinds)


def score_to_band(ai_score: int) -> str:
    """Band skor detektor; sengaja terpisah dari ai_score.score_to_band agar ambangnya bergerak sendiri."""
    if ai_score < MID_THRESHOLD:
        return AiBand.LOW
    if ai_score < HIGH_THRESHOLD:
        return AiBand.MID
    return AiBand.HIGH


def _attack_kinds(payload: dict) -> tuple[str, ...]:
    """Zero-width space / homoglyph yang dilaporkan Winston, ditulis sebagai bukti (tidak menambah skor)."""
    attack = payload.get("attack_detected")
    if not isinstance(attack, dict):
        return ()
    labels = {
        "zero_width_space": "penyisipan karakter lebar nol",
        "homoglyph_attack": "penggantian huruf dengan karakter mirip",
    }
    return tuple(label for key, label in labels.items() if attack.get(key))


# Kredit dipakai per kata; ±2.000 kata = beberapa esai lagi.
LOW_CREDIT_WARNING = 2_000


def _warn_if_credits_low(payload: dict) -> None:
    """Log peringatan sebelum kredit habis (402 membuat skor diam-diam turun ke heuristik)."""
    remaining = payload.get("credits_remaining")
    if not isinstance(remaining, (int, float)):
        return
    if remaining <= LOW_CREDIT_WARNING:
        logger.warning(
            "Kredit %s tinggal %s. Satu kredit terpakai per kata, jadi ini "
            "hanya beberapa esai lagi sebelum skor AI turun ke jalur cadangan.",
            PROVIDER_NAME,
            int(remaining),
        )


def detect(text: str) -> DetectorResult | None:
    """DetectorResult, atau None (tanpa kunci, teks di luar rentang, galat API) = jatuh ke heuristik.

    Tidak pernah melempar: API pihak ketiga tidak boleh menggagalkan pengumpulan tugas.
    """
    api_key = os.getenv("WINSTON_API_KEY", "").strip()
    if not api_key:
        return None

    if not MIN_CHARS <= len(text) <= MAX_CHARS:
        logger.info(
            "Teks %d karakter di luar rentang %d sampai %d yang diterima %s, "
            "memakai jalur lain",
            len(text),
            MIN_CHARS,
            MAX_CHARS,
            PROVIDER_NAME,
        )
        return None

    try:
        response = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "text": text,
                "sentences": False,  # skor per kalimat tidak dipakai
                "language": LANGUAGE,
                "version": MODEL_VERSION,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        # Kredit habis: kondisi lapangan paling mungkin, pesannya harus mudah dikenali di log.
        if response.status_code == 402:
            logger.warning(
                "%s menolak dengan 402: kredit habis. Skor AI memakai jalur "
                "cadangan sampai saldo diisi.",
                PROVIDER_NAME,
            )
            return None
        if response.status_code == 429:
            logger.warning(
                "%s membatasi laju permintaan (429). Skor AI memakai jalur "
                "cadangan untuk submission ini.",
                PROVIDER_NAME,
            )
            return None
        response.raise_for_status()
        payload = response.json()
        human_score = float(payload["score"])
        _warn_if_credits_low(payload)
    except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
        logger.warning("%s gagal, memakai jalur cadangan: %s", PROVIDER_NAME, exc)
        return None

    # Di luar 0..100 berarti kontrak API berubah; mundur, jangan dijepit diam-diam.
    if not 0.0 <= human_score <= 100.0:
        logger.warning(
            "Skor %s di luar rentang 0..100: %r", PROVIDER_NAME, human_score
        )
        return None

    return DetectorResult(
        # SATU-SATUNYA pembalikan skor Winston (human -> AI); jangan diulang di tempat lain.
        ai_probability=1.0 - (human_score / 100.0),
        reliable=len(text) >= RELIABLE_MIN_CHARS,
        attack_kinds=_attack_kinds(payload if isinstance(payload, dict) else {}),
    )
