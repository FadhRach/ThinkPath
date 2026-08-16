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

Jalankan dari folder ai_experiment:

    python -m src.evaluate_detector --limit 40
    python -m src.evaluate_detector --limit 200 --sleep 0.5
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import requests

from .config import CACHE_DIR, GOLD_DIR, detector_api_key
from .evaluate_baseline import bootstrap_backend, load_rows
from .evaluation import ScoreCache, balanced_sample, print_engine_comparison
from .evaluation import print_register_caveat

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
    # docstring DetectorResult pada backend/academics/detector.py.
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
    from academics.ai_score import score_ai_probability
    from academics.text_features import extract_features

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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bandingkan detektor eksternal terhadap heuristik E1."
    )
    parser.add_argument("--gold", default=str(GOLD_DIR / "gold_set.csv"))
    parser.add_argument(
        "--limit",
        type=int,
        default=40,
        help=(
            "jumlah sampel, diseimbangkan manusia dan AI. Default sengaja kecil: "
            "kredit terpakai per kata dan pendaftaran baru hanya memberi 2.500. "
            "Pakai 0 untuk semua."
        ),
    )
    parser.add_argument("--sleep", type=float, default=1.0, help="jeda antar permintaan")
    parser.add_argument("--split", choices=("train", "test"), default=None)
    parser.add_argument(
        "--mixed-as", choices=("ai", "human", "exclude"), default="exclude"
    )
    args = parser.parse_args()

    api_key = detector_api_key()
    if not api_key:
        raise SystemExit(
            "WINSTON_API_KEY belum diisi.\n"
            "Daftar di gowinston.ai, buka dashboard API, buat kunci, lalu\n"
            "isikan ke ai_experiment/.env. Pendaftaran memberi 2.500 kredit\n"
            "gratis, dan satu kredit terpakai per kata."
        )

    bootstrap_backend()
    from academics import detector

    rows = load_rows(Path(args.gold), args.split, args.mixed_as)
    if not rows:
        raise SystemExit("Tidak ada baris yang cocok dengan filter.")

    rows, skipped = eligible_rows(rows, detector)
    if skipped:
        print(
            f"{skipped} teks dilewati karena panjangnya di luar rentang "
            f"{detector.MIN_CHARS} sampai {detector.MAX_CHARS} karakter."
        )
    if not rows:
        raise SystemExit("Tidak ada teks yang panjangnya diterima penyedia.")

    rows = balanced_sample(rows, args.limit)
    words = sum(len(row["text"].split()) for row in rows)
    print(
        f"Akan menilai {len(rows)} teks, total {words} kata.\n"
        f"Skor yang sudah pernah diambil dibaca dari {CACHE.path}."
    )
    if words > FREE_CREDITS:
        print(
            f"\nCatatan: subset ini butuh sekitar {words} kredit, melampaui "
            f"{FREE_CREDITS} kredit\ngratis pendaftaran. Kalau saldomu masih "
            "kredit gratis, prosesnya akan\nberhenti dengan 402 di tengah jalan. "
            "Skor yang sudah terambil tetap\ntersimpan di cache, jadi setelah "
            "saldo diisi skrip akan melanjutkan,\nbukan mengulang."
        )

    detector_scores, heuristic_scores, labels = collect_scores(
        rows, api_key, args.sleep, detector
    )
    print_engine_comparison(
        detector.PROVIDER_NAME,
        detector_scores,
        heuristic_scores,
        labels,
        subheading=f"Versi model yang diukur: {detector.MODEL_VERSION}",
        worse_note=(
            f"  {detector.PROVIDER_NAME} TIDAK lebih baik pada subset ini. Jangan\n"
            "  menggeser ambang produksi, dan pertimbangkan mencabut\n"
            "  integrasinya. Detektor berbayar yang tidak mengungguli heuristik\n"
            "  gratis hanya menambah satu titik kegagalan."
        ),
        footer=(
            f"\n  Angka {detector.PROVIDER_NAME} di baris atas inilah yang mengisi\n"
            "  MID_THRESHOLD di backend/academics/detector.py. Jangan menyalin\n"
            "  ambang heuristik ke sana: kedua sebaran skor bentuknya berbeda."
        ),
    )
    print_register_caveat()
    return 0


if __name__ == "__main__":
    sys.exit(main())
