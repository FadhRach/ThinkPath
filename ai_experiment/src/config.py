"""Konfigurasi bersama untuk pembangun gold set.

Semua nilai yang mungkin ingin diubah tim ada di satu tempat ini, supaya tidak
tersebar sebagai angka ajaib di dalam skrip.
"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:  # dotenv opsional, environment variable tetap terbaca
    pass

DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
GOLD_DIR = DATA_DIR / "gold"

HUMAN_CACHE = CACHE_DIR / "human_openalex.jsonl"
AI_CACHE = CACHE_DIR / "ai_generated.jsonl"

# Batas akhir pengambilan teks manusia. ChatGPT rilis 30 November 2022, jadi
# apa pun yang terbit sebelum tanggal ini dijamin bukan hasil AI generatif.
# Margin satu bulan diambil untuk mengantisipasi selisih tanggal terbit daring
# dan tanggal terbit cetak.
HUMAN_CUTOFF_DATE = "2022-10-31"
HUMAN_START_DATE = "2015-01-01"

# Abstrak yang terlalu pendek tidak punya cukup sinyal, yang terlalu panjang
# biasanya hasil salah parse atau berisi seluruh bab.
MIN_WORDS = 120
MAX_WORDS = 400

OPENALEX_URL = "https://api.openalex.org/works"
# Bukan autentikasi. Mengisi mailto memasukkan permintaan ke polite pool
# OpenAlex sehingga tidak cepat kena pembatasan laju.
OPENALEX_MAILTO = os.getenv("OPENALEX_MAILTO", "").strip()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"

# Beberapa generator sekaligus, dan sengaja dari keluarga model yang berbeda
# (Llama, GPT-OSS, Qwen). Kalau seluruh sisi AI berasal dari satu model,
# detektor akan belajar mengenali model itu, bukan mengenali teks AI.
#
# Daftar ini bisa basi kapan saja karena penyedia menghentikan model tanpa
# pemberitahuan. gemma2-9b-it sempat ada di sini lalu hilang. Karena itu skrip
# memvalidasi ketersediaan model sebelum mulai.
#
# qwen/qwen3.6-27b sengaja tidak dipakai. Model itu menuliskan proses
# berpikirnya lebih dulu dalam bahasa Inggris TANPA tag <think>, sehingga tidak
# bisa dibersihkan berdasarkan tag, dan keluarannya membengkak sampai lima kali
# panjang yang diminta. Tambahkan kembali lewat --models kalau perilakunya sudah
# berubah.
DEFAULT_MODELS = (
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
)

# Panjang teks AI harus mendekati abstrak manusianya. Kalau meleset jauh,
# panjang jadi petunjuk gratis bagi detektor.
LENGTH_TOLERANCE = 0.25

REQUEST_TIMEOUT = 60
MAX_RETRIES = 5
BACKOFF_BASE_SECONDS = 2.0


def ensure_dirs() -> None:
    for directory in (DATA_DIR, CACHE_DIR, GOLD_DIR):
        directory.mkdir(parents=True, exist_ok=True)
