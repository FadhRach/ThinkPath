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
   temperatur, dan pembatasan nilai diambil dari apps.analysis (pipeline + providers/groq), sehingga angka
   di sini tidak pernah mengukur konfigurasi yang berbeda dari yang benar benar
   jalan. Kalau prompt produksi berubah, angka di sini ikut berubah.

3. **Setiap skor disimpan ke cache.** Bukan demi biaya seperti pada detektor,
   melainkan demi batas token harian Groq. Gold set penuh menghabiskan ratusan
   ribu token, dan tanpa cache pengukuran tidak bisa dicicil lintas hari.

Dipakai oleh notebooks/04_rantai_llm_dan_detektor.ipynb.
"""
from __future__ import annotations

import json
import time

import requests

from .config import (
    BACKOFF_BASE_SECONDS,
    CACHE_DIR,
    MAX_RETRIES,
)
from .evaluation import ScoreCache
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
    from apps.analysis.engines.ai_score import score_ai_probability
    from apps.analysis.engines.text_features import extract_features

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


def production_llm():
    """Antarmuka kecil atas lapisan Groq produksi (dipakai fetch_ai_probability dan dipalsukan tes)."""
    from types import SimpleNamespace

    from apps.analysis import pipeline
    from apps.analysis.providers import groq

    return SimpleNamespace(
        _call_groq=groq.call, _clamp=pipeline._clamp, DEFAULT_MODEL=groq.DEFAULT_MODEL
    )
