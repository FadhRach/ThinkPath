"""Lapisan cache di depan detektor eksternal.

Alasan modul ini terpisah dari detector.py, bukan digabung ke dalamnya:
detector.py adalah klien penyedia yang murni, dan docstring-nya menjanjikan
bahwa pindah penyedia cukup dengan mengganti isi berkas itu. Kalau logika cache
ikut tinggal di sana, setiap pergantian penyedia harus menulis ulang cache-nya
juga, padahal cache-nya sama sekali tidak bergantung pada penyedia mana pun.
Pemisahan ini juga membuat detector.detect() tetap bisa diuji tanpa basis data.

Yang di-cache hanya keberhasilan. Kegagalan seperti 402 kredit habis, 429 batas
laju, dan timeout semuanya bersifat sementara. Menyimpan "tidak ada hasil" akan
membekukan submission itu di jalur cadangan selamanya, bahkan setelah saldo
diisi, dan tidak akan ada yang menyadarinya karena sistem memang dirancang
tenang saat detektor gagal.
"""
from __future__ import annotations

import hashlib
import logging

from django.db import DatabaseError

from . import detector
from .models import DetectorScore

logger = logging.getLogger(__name__)


def text_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _lookup(key: str) -> detector.DetectorResult | None:
    row = (
        DetectorScore.objects.filter(
            text_hash=key,
            provider=detector.PROVIDER_NAME,
            model_version=detector.MODEL_VERSION,
            language=detector.LANGUAGE,
        )
        .order_by("-created_at")
        .first()
    )
    if row is None:
        return None
    return detector.DetectorResult(
        ai_probability=row.ai_probability,
        reliable=row.reliable,
        attack_kinds=tuple(row.attack_kinds or ()),
    )


def _store(key: str, result: detector.DetectorResult) -> None:
    DetectorScore.objects.update_or_create(
        text_hash=key,
        provider=detector.PROVIDER_NAME,
        model_version=detector.MODEL_VERSION,
        language=detector.LANGUAGE,
        defaults={
            "ai_probability": result.ai_probability,
            "reliable": result.reliable,
            "attack_kinds": list(result.attack_kinds),
        },
    )


def detect_cached(text: str) -> detector.DetectorResult | None:
    """detector.detect() dengan cache, dan cache yang tidak pernah menggagalkan apa pun.

    Galat basis data diperlakukan sama seperti seluruh kegagalan lain di jalur
    ini: dicatat lalu dilewati. Tabel cache yang bermasalah boleh membuat sistem
    membayar dua kali, dan tidak boleh membuat mahasiswa gagal mengumpulkan
    tugas. Itu pertukaran yang jelas arahnya.
    """
    key = text_key(text)

    try:
        cached = _lookup(key)
    except DatabaseError as exc:
        logger.warning("Cache detektor gagal dibaca, memanggil penyedia: %s", exc)
        cached = None

    if cached is not None:
        return cached

    result = detector.detect(text)
    if result is None:
        return None

    try:
        _store(key, result)
    except DatabaseError as exc:
        # Skornya tetap dipakai. Yang hilang cuma penghematan pada panggilan
        # berikutnya, bukan hasil yang sudah terlanjur dibayar.
        logger.warning("Skor detektor gagal disimpan ke cache: %s", exc)

    return result
