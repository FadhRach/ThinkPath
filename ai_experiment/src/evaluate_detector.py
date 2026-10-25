"""Tahap 3: apakah detektor berbayar benar benar lebih baik daripada heuristik kita.

Pertanyaan yang dijawab berkas ini cuma satu, dan jawabannya menentukan apakah
integrasi detektor eksternal layak dipertahankan sama sekali:

    Pada teks berbahasa Indonesia yang sama persis, detektor mana yang lebih
    memisahkan manusia dari AI?

Karena itu kedua skor dihitung pada SUBSET YANG IDENTIK, bukan pada dua
pengambilan sampel yang berbeda. Membandingkan angka detektor di 40 sampel
terhadap angka heuristik di 921 sampel yang sudah tercatat di README adalah
perbandingan yang tidak sah, dan godaannya besar karena angkanya sudah ada.

Riwayat yang menjelaskan kenapa berkas ini ada. Integrasi pertama memakai
Sapling dan dibatalkan sebelum sempat diukur, setelah ketahuan detektornya
English-only sementara produk ini menilai esai berbahasa Indonesia. Winston
mencantumkan `id` di daftar bahasa API-nya, tetapi itu tetap klaim penyedia.
Klaim penyedia bukan hasil ukur, dan berkas inilah yang mengubahnya jadi angka.

Tiga hal yang membentuk seluruh rancangan berkas ini:

1. **Kredit terpakai per kata.** Winston menghitung satu kredit per kata, dan
   pendaftaran baru hanya memberi 2.500 kredit. Gold set penuh sekitar 170.000
   kata. Karena itu --limit defaultnya kecil, sampelnya diseimbangkan supaya
   limit kecil pun tetap memberi angka yang berarti, dan setiap skor yang pernah
   dibayar disimpan ke cache. Menjalankan ulang skrip ini TIDAK boleh membayar
   dua kali. Itu bukan optimisasi, itu syarat supaya kalibrasi bisa dikerjakan
   bertahap.

2. **Arah skornya terbalik.** Winston mengembalikan "human score": 0 berarti
   hampir pasti AI, 100 berarti hampir pasti manusia. Pembalikannya memakai
   ambang dan konstanta yang sama persis dengan klien produksi, diimpor dari
   backend, supaya kalibrasi tidak pernah mengukur sesuatu yang berbeda dari
   yang benar benar jalan di produksi.

3. **Gold setnya abstrak akademik, bukan esai mahasiswa.** Ketidakcocokan
   register yang sudah didokumentasikan di README berlaku sama persis di sini.
   Peringatannya dicetak di keluaran skrip, bukan hanya ditulis di dokumen,
   karena yang membaca angka biasanya tidak sedang membaca dokumen.

Dipakai oleh notebooks/04_rantai_llm_dan_detektor.ipynb.
"""
from __future__ import annotations

import time

import requests

from .config import CACHE_DIR
from .evaluation import ScoreCache

CACHE = ScoreCache(CACHE_DIR / "detector_scores.jsonl")

# Kredit gratis saat pendaftaran Winston, satu kredit per kata.
FREE_CREDITS = 2_500

REQUEST_TIMEOUT = 30


def fetch_ai_probability(text: str, api_key: str, detector) -> float:
    """Satu panggilan ke penyedia. Mengembalikan probabilitas AI 0..1.

    Melempar kalau gagal, dan itu disengaja. Klien produksi meratakan semua
    kegagalan menjadi None supaya pengumpulan tugas tidak pernah gagal. Di sini
    kegagalan HARUS berisik: kalibrasi yang diam diam melewati separuh sampel
    akan melaporkan angka yang salah dengan penuh percaya diri.

    Konstanta URL, versi model, dan bahasa diambil dari modul produksi, bukan
    disalin, supaya angka di sini tidak pernah mengukur konfigurasi yang berbeda
    dari yang benar benar jalan.
    """
    response = requests.post(
        detector.API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "text": text,
            "sentences": False,
            "language": detector.LANGUAGE,
            "version": detector.MODEL_VERSION,
        },
        timeout=REQUEST_TIMEOUT,
    )
    if response.status_code == 402:
        raise SystemExit(
            f"\n{detector.PROVIDER_NAME} menjawab 402: kredit habis.\n"
            f"Skor yang sudah diambil tersimpan di {CACHE.path} dan tidak\n"
            "akan dibayar ulang. Isi saldo lalu jalankan lagi; skrip akan\n"
            "melanjutkan dari tempatnya berhenti, bukan mengulang dari awal."
        )
    response.raise_for_status()
    human_score = float(response.json()["score"])
    # Pembalikan yang sama persis dengan detector.detect(). Lihat alasannya di
    # docstring DetectorResult pada backend/apps/analysis/providers/winston.py.
    return 1.0 - (human_score / 100.0)


def eligible_rows(rows: list[dict], detector) -> tuple[list[dict], int]:
    """Buang teks yang panjangnya di luar rentang yang diterima penyedia.

    Mengirimnya tetap akan ditolak, dan yang lebih buruk: kalau ditolak satu per
    satu di tengah proses, sampel yang tersisa jadi condong ke teks panjang
    tanpa ada yang menyadarinya.
    """
    kept = [
        row
        for row in rows
        if detector.MIN_CHARS <= len(row["text"]) <= detector.MAX_CHARS
    ]
    return kept, len(rows) - len(kept)


def collect_scores(
    rows: list[dict], api_key: str, sleep_seconds: float, detector
) -> tuple[list[float], list[float], list[int]]:
    """Skor detektor dan skor heuristik pada baris yang sama persis."""
    from apps.analysis.engines.ai_score import score_ai_probability
    from apps.analysis.engines.text_features import extract_features

    cache = CACHE.load()
    cached_hits = 0

    detector_scores: list[float] = []
    heuristic_scores: list[float] = []
    labels: list[int] = []

    for index, row in enumerate(rows, start=1):
        text = row["text"]
        # Versi model ikut ke dalam kunci, dengan alasan yang sama seperti pada
        # cache produksi: skor lama berasal dari model lain dan tidak boleh
        # dipakai ulang begitu versinya dinaikkan.
        key = ScoreCache.key(detector.PROVIDER_NAME, detector.MODEL_VERSION, text)

        if key in cache:
            ai_probability = cache[key]
            cached_hits += 1
        else:
            ai_probability = fetch_ai_probability(text, api_key, detector)
            CACHE.append(key, ai_probability)
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)

        detector_scores.append(ai_probability * 100.0)
        heuristic_scores.append(
            float(score_ai_probability(extract_features(text)).score)
        )
        labels.append(row["binary_label"])

        if index % 10 == 0 or index == len(rows):
            print(f"  {index}/{len(rows)} selesai", flush=True)

    billed = len(rows) - cached_hits
    words = sum(len(row["text"].split()) for row in rows)
    print(
        f"\n{cached_hits} skor dari cache, {billed} dipanggil baru. "
        f"Subset ini {words} kata, jadi sekitar {words} kredit kalau semuanya "
        "dipanggil baru."
    )
    return detector_scores, heuristic_scores, labels
