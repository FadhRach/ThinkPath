"""Ukur lapisan kedua rantai E1: skor ai_probability dari Groq.

Rantai produksi punya tiga lapis, dan sampai berkas ini ada hanya dua yang
pernah diukur:

    detektor eksternal (evaluate_detector.py, terukur)
      -> ai_probability Groq          (BELUM PERNAH DIUKUR SAMA SEKALI)
        -> heuristik ai_score.py      (evaluate_baseline.py, terukur)

Lapisan tengah inilah yang menanggung seluruh beban begitu kredit detektor
habis, dan itu bukan kemungkinan yang jauh: kreditnya terpakai per kata. Selama
ini ia dianggap lebih baik daripada heuristik tanpa satu pun angka. Kalau
ternyata tidak, jaring pengaman yang selama ini diasumsikan sebenarnya tidak
ada, dan yang benar benar menangkap adalah heuristik dengan FPR 0,838.

Kenapa ini dikerjakan sebelum menambah kredit detektor: pengukuran di sini
gratis, memakai gold set penuh, dan hasilnya yang menentukan apakah membayar
detektor eksternal masih masuk akal.

Tiga hal yang membentuk rancangan berkas ini, sama seperti evaluate_detector.py:

1. **Kedua skor dihitung pada subset yang sama persis.** Membandingkan angka
   Groq di 200 sampel terhadap angka heuristik 921 sampel yang sudah tercatat di
   README adalah perbandingan yang tidak sah, dan godaannya besar karena
   angkanya sudah ada.

2. **Fungsi produksi dipanggil langsung, bukan disalin.** Prompt, model,
   temperatur, dan pembatasan nilai diambil dari academics.llm, sehingga angka
   di sini tidak pernah mengukur konfigurasi yang berbeda dari yang benar benar
   jalan. Kalau prompt produksi berubah, angka di sini ikut berubah.

3. **Setiap skor disimpan ke cache.** Bukan demi biaya seperti pada detektor,
   melainkan demi batas token harian Groq. Gold set penuh menghabiskan ratusan
   ribu token, dan tanpa cache pengukuran tidak bisa dicicil lintas hari.

Jalankan dari folder ai_experiment:

    python -m src.evaluate_groq --limit 200
    python -m src.evaluate_groq --limit 0 --sleep 1.0   # seluruh gold set
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests

from .config import (
    BACKOFF_BASE_SECONDS,
    CACHE_DIR,
    GOLD_DIR,
    GROQ_API_KEY,
    MAX_RETRIES,
)
from .evaluate_baseline import bootstrap_backend, load_rows
from .evaluation import ScoreCache, balanced_sample, print_engine_comparison
from .evaluation import print_register_caveat
# Dipakai bersama dengan pembangun gold set. Keduanya menabrak tembok yang sama
# pada kunci yang sama, dan dua salinan aturan yang sama pasti akan berbeda.
from .generate import is_daily_quota

CACHE = ScoreCache(CACHE_DIR / "groq_scores.jsonl")

# Gold set tidak punya kolom jenjang studi, sedangkan prompt produksi
# membutuhkannya. Dipatok satu nilai untuk seluruh sampel supaya jenjang tidak
# menjadi variabel yang ikut bergerak tanpa disengaja.
DEFAULT_EDUCATION_LEVEL = "S1"

RETRY_STATUSES = (429, 500, 502, 503, 504)


def fetch_ai_probability(text: str, education_level: str, llm) -> float:
    """Satu skor 0..100 dari lapisan Groq produksi.

    Melempar kalau gagal, dan itu disengaja. Klien produksi meratakan semua
    kegagalan menjadi fallback supaya pengumpulan tugas tidak pernah gagal. Di
    sini kegagalan HARUS berisik: kalibrasi yang diam diam melewati separuh
    sampel akan melaporkan angka yang salah dengan penuh percaya diri.

    Yang dicoba ulang hanya kegagalan sementara, yaitu batas laju dan galat
    server. Kegagalan seperti kunci ditolak atau model tidak dikenal tidak akan
    berubah karena diulang, jadi langsung dilempar.

    Pembatasan nilai memakai _clamp milik produksi, bukan pembatasan sendiri,
    supaya skor yang diukur di sini sama persis dengan skor yang tersimpan di
    database ketika lapisan ini yang menang.
    """
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            raw = llm._call_groq(text, education_level)
            return float(llm._clamp(raw["ai_probability"], 0, 100))
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            body = exc.response.text if exc.response is not None else ""
            if status == 429 and is_daily_quota(body):
                raise SystemExit(
                    "\nJatah token harian Groq habis untuk model ini.\n"
                    f"{body[:300]}\n\n"
                    f"Skor yang sudah terambil tersimpan di {CACHE.path} dan\n"
                    "tidak akan dipanggil ulang. Jalankan lagi besok; skrip\n"
                    "melanjutkan dari tempatnya berhenti, bukan mengulang."
                )
            if status not in RETRY_STATUSES:
                raise
            last_error = exc
        except (requests.RequestException, json.JSONDecodeError) as exc:
            last_error = exc
        except (KeyError, TypeError, ValueError) as exc:
            # Model membalas JSON tanpa ai_probability, atau nilainya bukan
            # angka. Sekali dua kali wajar pada suhu rendah sekalipun.
            last_error = exc

        if attempt < MAX_RETRIES - 1:
            time.sleep(BACKOFF_BASE_SECONDS * (2**attempt))

    raise RuntimeError(f"Groq gagal setelah {MAX_RETRIES} percobaan: {last_error}")


def collect_scores(
    rows: list[dict], education_level: str, sleep_seconds: float, model: str, llm
) -> tuple[list[float], list[float], list[int]]:
    """Skor Groq dan skor heuristik pada baris yang sama persis."""
    from academics.ai_score import score_ai_probability
    from academics.text_features import extract_features

    cache = CACHE.load()
    cached_hits = 0

    groq_scores: list[float] = []
    heuristic_scores: list[float] = []
    labels: list[int] = []

    for index, row in enumerate(rows, start=1):
        text = row["text"]
        # Nama model ikut ke dalam kunci. Tanpa itu, mengganti GROQ_MODEL akan
        # membaca skor model lama dari cache dan melaporkannya sebagai hasil
        # model baru.
        key = ScoreCache.key(model, text)

        if key in cache:
            score = cache[key]
            cached_hits += 1
        else:
            score = fetch_ai_probability(text, education_level, llm)
            CACHE.append(key, score)
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)

        groq_scores.append(score)
        heuristic_scores.append(
            float(score_ai_probability(extract_features(text)).score)
        )
        labels.append(row["binary_label"])

        if index % 10 == 0 or index == len(rows):
            print(f"  {index}/{len(rows)} selesai", flush=True)

    called = len(rows) - cached_hits
    print(f"\n{cached_hits} skor dari cache, {called} dipanggil baru.")
    return groq_scores, heuristic_scores, labels


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bandingkan lapisan Groq terhadap heuristik E1."
    )
    parser.add_argument("--gold", default=str(GOLD_DIR / "gold_set.csv"))
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help=(
            "jumlah sampel, diseimbangkan manusia dan AI. Default 200 karena "
            "Groq membatasi token per hari; skor tersimpan di cache sehingga "
            "sisanya bisa dikerjakan besoknya. Pakai 0 untuk semua."
        ),
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.5,
        help="jeda antar permintaan, penahan batas laju",
    )
    parser.add_argument("--split", choices=("train", "test"), default=None)
    parser.add_argument(
        "--mixed-as", choices=("ai", "human", "exclude"), default="exclude"
    )
    parser.add_argument(
        "--education-level",
        default=DEFAULT_EDUCATION_LEVEL,
        help="jenjang yang dikirim ke prompt produksi untuk seluruh sampel",
    )
    args = parser.parse_args()

    if not GROQ_API_KEY:
        raise SystemExit(
            "GROQ_API_KEY belum diisi di ai_experiment/.env.\n"
            "Kunci yang sama dipakai lapisan kedua produksi, jadi kalau kosong\n"
            "di sini, ada baiknya memeriksa backend/.env juga."
        )

    bootstrap_backend()
    import os

    from academics import llm

    model = os.getenv("GROQ_MODEL", llm.DEFAULT_MODEL)

    rows = load_rows(Path(args.gold), args.split, args.mixed_as)
    if not rows:
        raise SystemExit("Tidak ada baris yang cocok dengan filter.")

    rows = balanced_sample(rows, args.limit)
    print(
        f"Akan menilai {len(rows)} teks dengan {model}.\n"
        f"Skor yang sudah pernah diambil dibaca dari {CACHE.path}."
    )

    groq_scores, heuristic_scores, labels = collect_scores(
        rows, args.education_level, args.sleep, model, llm
    )
    print_engine_comparison(
        "Groq",
        groq_scores,
        heuristic_scores,
        labels,
        subheading=f"Model yang diukur: {model}",
        worse_note=(
            "  Groq TIDAK lebih baik daripada heuristik pada subset ini.\n"
            "  Artinya lapisan kedua rantai bukan jaring pengaman, dan ketika\n"
            "  kredit detektor eksternal habis, mutu skor AI langsung jatuh ke\n"
            "  tingkat heuristik tanpa peredam apa pun. Ini temuan yang harus\n"
            "  dilaporkan, bukan diabaikan."
        ),
    )
    print_register_caveat(
        "Ada satu ketidakcocokan tambahan yang khas berkas ini. Prompt produksi\n"
        "meminta model menilai JAWABAN MAHASISWA, sedangkan yang diberikan di\n"
        "sini abstrak jurnal. Sisi manusia gold set ditulis peneliti terlatih,\n"
        "dan tulisan rapi memang cenderung dinilai lebih mirip AI. Karena itu\n"
        "angka Groq di sini condong PESIMIS, bukan optimis."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
