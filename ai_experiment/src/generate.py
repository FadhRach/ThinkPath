"""Hasilkan padanan AI untuk tiap abstrak manusia.

Dua keputusan penting di modul ini, keduanya soal menghindari dataset yang
menipu:

1. Model hanya diberi JUDUL, tidak pernah diberi abstrak aslinya. Tujuannya
   mengunci topik di kedua sisi tanpa membuat model sekadar memparafrase. Kalau
   topik tidak dikunci, detektor bisa curang dengan mempelajari perbedaan zaman
   atau tema, bukan perbedaan gaya, karena sisi manusia berasal dari sebelum
   2022 sedangkan sisi AI dibuat sekarang.

2. Prompt dan model diputar bergantian. Kalau seluruh sisi AI lahir dari satu
   prompt dan satu model, yang dipelajari detektor adalah jejak prompt itu, dan
   akurasinya akan runtuh pada teks AI dari sumber lain.

Kelas "mixed" dibuat terpisah dan justru menerima teks aslinya, karena kasus
nyata yang paling sering di lapangan adalah tulisan manusia yang dipoles AI.
"""
from __future__ import annotations

import json
import random
import re
import time

import requests

from .config import (
    BACKOFF_BASE_SECONDS,
    GROQ_API_KEY,
    GROQ_MODELS_URL,
    GROQ_URL,
    LENGTH_TOLERANCE,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
)

# Empat gaya permintaan yang berbeda. Variasi ini yang menjaga sisi AI tidak
# seragam. Tiap template menerima {title} dan {words}.
PROMPT_VARIANTS: dict[str, str] = {
    "formal": (
        "Tuliskan abstrak ilmiah berbahasa Indonesia untuk penelitian berjudul "
        '"{title}". Panjang sekitar {words} kata. Gunakan ragam akademik baku. '
        "Keluarkan hanya abstraknya, tanpa judul dan tanpa kata pengantar."
    ),
    "structured": (
        'Buat abstrak penelitian berbahasa Indonesia untuk judul "{title}". '
        "Susun mengikuti alur latar belakang, metode, hasil, dan simpulan. "
        "Panjang sekitar {words} kata. Keluarkan hanya abstraknya."
    ),
    "plain": (
        'Tulis ringkasan penelitian berbahasa Indonesia untuk judul "{title}" '
        "sepanjang kira kira {words} kata. Tulis mengalir dalam satu paragraf, "
        "hindari daftar berpoin. Keluarkan hanya ringkasannya."
    ),
    "natural": (
        'Tulis abstrak berbahasa Indonesia untuk penelitian berjudul "{title}". '
        "Panjang sekitar {words} kata. Tulis seperti mahasiswa yang menyusun "
        "abstrak skripsinya sendiri, jangan terlalu kaku dan jangan memakai "
        "frasa transisi yang berlebihan. Keluarkan hanya abstraknya."
    ),
}

# Untuk kelas campuran. Di sini teks asli memang sengaja diberikan.
POLISH_PROMPT = (
    "Perbaiki dan rapikan teks abstrak berbahasa Indonesia berikut tanpa "
    "mengubah isi maupun temuannya. Pertahankan panjang yang kurang lebih sama. "
    "Keluarkan hanya hasil perbaikannya.\n\n{text}"
)


class GenerationError(RuntimeError):
    pass


class DailyQuotaExceeded(GenerationError):
    """Jatah token harian model itu habis.

    Dipisahkan dari GenerationError biasa karena penanganannya berbeda secara
    mendasar. Sampel yang gagal karena keluaran buruk layak dilewati lalu
    dilanjutkan; jatah harian yang habis membuat SELURUH sampel berikutnya untuk
    model itu ikut gagal, jadi meneruskannya hanya membuang waktu dan
    memiringkan sebaran generator tanpa terlihat.
    """


class _Retryable(Exception):
    """Galat sementara yang layak dicoba lagi."""


def is_daily_quota(body: str) -> bool:
    """Bedakan batas harian dari batas per menit, keduanya dijawab 429.

    Batas per menit pulih dalam hitungan detik dan layak ditunggu dengan
    backoff. Batas harian tidak akan pulih berapa kali pun diulang, jadi
    mengulangnya lima kali hanya membuang waktu dan menyamarkan penyebabnya.
    Pesan Groq menyebut "tokens per day (TPD)" untuk kasus kedua.
    """
    lowered = body.lower()
    return "tokens per day" in lowered or "tpd" in lowered


def available_models() -> set[str]:
    """Model yang benar benar dilayani akun ini saat skrip dijalankan.

    Penyedia menghentikan model tanpa pemberitahuan. Tanpa pemeriksaan ini,
    satu nama basi di daftar bawaan membuat seperempat sampel gagal diam diam,
    dan sebaran generator jadi timpang tanpa ada yang sadar.
    """
    if not GROQ_API_KEY:
        return set()
    try:
        response = requests.get(
            GROQ_MODELS_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return {entry["id"] for entry in response.json().get("data", [])}
    except (requests.RequestException, KeyError, json.JSONDecodeError):
        return set()


def _chat(prompt: str, model: str, temperature: float) -> str:
    if not GROQ_API_KEY:
        raise GenerationError(
            "GROQ_API_KEY belum di-set. Isi di file .env atau environment."
        )

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                },
                timeout=REQUEST_TIMEOUT,
            )
            if response.status_code == 429 and is_daily_quota(response.text):
                # Berhenti seketika, tanpa backoff. Jatah harian tidak pulih
                # dalam hitungan detik berapa pun, jadi lima percobaan
                # berbackoff hanya membuang waktu lalu gagal juga.
                raise DailyQuotaExceeded(
                    f"jatah token harian {model} habis: {response.text[:220]}"
                )
            if response.status_code in (429, 500, 502, 503, 504):
                # Isi pesannya ikut dibawa, bukan hanya kodenya. Tanpa itu,
                # tembok harian dan batas per menit terlihat identik di log,
                # padahal yang satu layak ditunggu dan yang lain tidak.
                raise _Retryable(
                    f"status {response.status_code}: {response.text[:200]}"
                )
            if response.status_code >= 400:
                # Galat klien seperti model tidak dikenal atau kunci ditolak.
                # Mengulanginya tidak akan mengubah apa pun, hanya membuang
                # waktu dan kuota.
                raise GenerationError(
                    f"{model} ditolak dengan status {response.status_code}: "
                    f"{response.text[:200]}"
                )
            content = response.json()["choices"][0]["message"]["content"]
            content = content or ""
            cleaned = clean_generated(content)
            if len(cleaned.split()) < MIN_GENERATED_WORDS:
                # Jumlah kata mentah ikut dilaporkan karena tanpa itu, bug di
                # clean_generated menyamar sebagai "model membalas pendek".
                # Kalau mentahnya panjang tapi bersihnya nol, yang rusak adalah
                # pembersihannya, bukan modelnya.
                raise _Retryable(
                    f"keluaran terlalu pendek setelah dibersihkan "
                    f"({len(cleaned.split())} kata, mentah "
                    f"{len(content.split())} kata)"
                )
            if is_mostly_english(cleaned):
                raise _Retryable("keluaran didominasi bahasa Inggris")
            return cleaned
        except (_Retryable, requests.RequestException, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(BACKOFF_BASE_SECONDS * (2**attempt))
    raise GenerationError(f"Groq gagal setelah {MAX_RETRIES} percobaan: {last_error}")


# Model penalaran seperti Qwen menuliskan proses berpikirnya lebih dulu, sering
# dalam bahasa Inggris dan jauh lebih panjang daripada jawabannya sendiri.
THINK_BLOCK = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>", re.DOTALL | re.IGNORECASE)
# Blok penalaran yang tidak pernah ditutup. Ambil apa pun setelah tag pembuka.
UNCLOSED_THINK = re.compile(r"^.*?<think(?:ing)?>", re.DOTALL | re.IGNORECASE)

# Label pembuka yang disisipkan model meski diminta hanya mengeluarkan isinya.
#
# Dua label ini sengaja dipisah karena nasib isinya berbeda. "Judul: ..."
# adalah metadata, jadi seluruh barisnya dibuang berikut isinya. Sedangkan pada
# "Abstrak: ...", isi setelah titik dua ADALAH abstraknya, jadi yang boleh
# dibuang hanya labelnya.
#
# Tiga hal yang harus dijaga di kedua pola. Pertama, hanya spasi mendatar yang
# boleh dilewati, bukan \s, karena \s ikut menelan baris baru sehingga seluruh
# teks termakan. Kedua, kata label baru dianggap label kalau diikuti titik dua
# atau langsung berakhir baris. Tanpa syarat itu, abstrak yang kebetulan diawali
# kata "Ringkasan penelitian ini ..." ikut terpotong. Ketiga, jangkarnya \A dan
# bukan ^ dengan MULTILINE: yang dicari label PEMBUKA, dan pola beranjangkar ^
# bisa mencocok di awal baris mana pun sehingga sub(count=1) berpotensi
# memotong bagian tengah abstrak.
#
# Syarat \n di akhir TITLE_LINE itu yang menjaga keamanannya. Versi sebelumnya
# menutup dengan (?::[ \t]*.*)?$ untuk kedua label sekaligus, dan karena model
# kerap membalas seluruh abstrak dalam satu baris yang diawali "Abstrak: ",
# .* melahap sampai akhir baris — yaitu seluruh teks — sehingga hasil
# bersihnya kosong. Kegagalannya sistematis, selalu pada kombinasi model dan
# varian prompt yang sama, jadi satu sel penuh rancangan eksperimen hilang.
TITLE_LINE = re.compile(
    r"\A[ \t]*(?:#{1,6}[ \t]*)?\*{0,2}[ \t]*"
    r"(?:judul|title)"
    r"[ \t]*\*{0,2}[ \t]*:[ \t]*[^\n]*\n",
    re.IGNORECASE,
)
ABSTRACT_LABEL = re.compile(
    r"\A[ \t]*(?:#{1,6}[ \t]*)?\*{0,2}[ \t]*"
    r"(?:abstrak|abstract|ringkasan|summary)"
    r"[ \t]*\*{0,2}[ \t]*(?::[ \t]*|[ \t]*\n)",
    re.IGNORECASE,
)
MARKDOWN_MARKS = re.compile(r"[*_`#]+")
WHITESPACE = re.compile(r"\s+")

MIN_GENERATED_WORDS = 50

# Penjaga bahasa. Sebagian model menuliskan penalaran berbahasa Inggris lebih
# dulu tanpa tag apa pun, sehingga tidak bisa ditangkap dengan membuang tag.
# Yang diminta adalah teks berbahasa Indonesia, jadi keluaran yang didominasi
# kata fungsi Inggris ditolak apa pun penyebabnya.
ID_STOPWORDS = frozenset(
    "yang dan di untuk dengan pada ini dari adalah tidak dalam akan atau "
    "sebagai serta dapat oleh karena juga".split()
)
EN_STOPWORDS = frozenset(
    "the of and to in is that for with this are as it be by on an".split()
)
WORD_TOKENS = re.compile(r"[a-z']+")


def is_mostly_english(text: str) -> bool:
    words = WORD_TOKENS.findall(text.lower())
    if len(words) < 30:
        return False
    indonesian = sum(1 for word in words if word in ID_STOPWORDS)
    english = sum(1 for word in words if word in EN_STOPWORDS)
    return english > indonesian


def clean_generated(text: str) -> str:
    """Buang artefak format dari keluaran model.

    Ini bukan kosmetik. Kalau `**Abstrak**` atau blok `<think>` lolos ke
    dataset, detektor akan belajar mengenali penanda format itu, bukan mengenali
    teks AI. Akurasinya akan terlihat tinggi karena alasan yang sepenuhnya
    salah, dan runtuh begitu ketemu teks AI yang ditempel siswa tanpa format.
    """
    if "<think" in text.lower():
        text = THINK_BLOCK.sub(" ", text)
        if "<think" in text.lower():
            text = UNCLOSED_THINK.sub(" ", text)
        text = re.sub(r"</?think(?:ing)?>", " ", text, flags=re.IGNORECASE)

    # Buang label pembuka berulang kali, karena model kerap menumpuk
    # "Judul: ..." lalu "Abstrak:" di baris berikutnya. Karena polanya
    # berjangkar \A, .strip() tiap putaran itulah yang membuat label bertumpuk
    # tetap terjangkau.
    for _ in range(4):
        stripped = TITLE_LINE.sub("", text, count=1)
        stripped = ABSTRACT_LABEL.sub("", stripped, count=1).strip()
        if stripped == text.strip():
            break
        text = stripped

    text = MARKDOWN_MARKS.sub("", text)
    return WHITESPACE.sub(" ", text).strip()


def _length_off_target(text: str, target_words: int) -> bool:
    actual = len(text.split())
    if target_words <= 0:
        return False
    return abs(actual - target_words) / target_words > LENGTH_TOLERANCE


def generate_ai_counterpart(
    human_row: dict, model: str, variant: str, rng: random.Random
) -> dict:
    """Buat satu abstrak AI dengan topik yang sama, tanpa melihat teks aslinya.

    Panjang target disamakan dengan abstrak manusianya. Kalau tidak disamakan,
    panjang teks sendiri menjadi petunjuk gratis bagi detektor, dan hasil
    evaluasi jadi terlalu optimistis.
    """
    words = human_row["word_count"]
    prompt = PROMPT_VARIANTS[variant].format(title=human_row["title"], words=words)
    text = _chat(prompt, model, temperature=rng.uniform(0.6, 1.0))

    # Model kerap mengabaikan panjang yang diminta. Satu kali koreksi tegas
    # sudah cukup untuk sebagian besar kasus, dan jauh lebih murah daripada
    # membiarkan panjang jadi petunjuk gratis bagi detektor.
    if _length_off_target(text, words):
        retry_prompt = (
            f"{prompt}\n\nPenting: panjangnya harus benar benar sekitar {words} "
            f"kata. Versi sebelumnya {len(text.split())} kata, terlalu "
            f"{'pendek' if len(text.split()) < words else 'panjang'}."
        )
        retry_text = _chat(retry_prompt, model, temperature=0.5)
        if not _length_off_target(retry_text, words):
            text = retry_text
        elif len(retry_text.split()) < len(text.split()):
            text = retry_text

    # Kalau setelah koreksi panjangnya masih meleset jauh, sampel dibuang.
    # Menyimpannya akan menggeser rata rata panjang kelas AI, dan panjang
    # berubah menjadi petunjuk gratis yang membuat evaluasi terlihat bagus
    # karena alasan yang salah. Lebih baik kehilangan satu sampel.
    if abs(len(text.split()) - words) / max(1, words) > LENGTH_TOLERANCE * 2:
        raise GenerationError(
            f"panjang tetap meleset jauh ({len(text.split())} kata, "
            f"target {words}), sampel dibuang"
        )

    return {
        "openalex_id": human_row["openalex_id"],
        "title": human_row["title"],
        "text": text,
        "year": human_row["year"],
        "field": human_row["field"],
        "word_count": len(text.split()),
        "label": "ai",
        "generator": model,
        "prompt_variant": variant,
    }


def generate_mixed_counterpart(human_row: dict, model: str) -> dict:
    """Teks manusia yang dipoles AI. Kasus paling nyata di lapangan."""
    prompt = POLISH_PROMPT.format(text=human_row["text"])
    text = _chat(prompt, model, temperature=0.4)
    return {
        "openalex_id": human_row["openalex_id"],
        "title": human_row["title"],
        "text": text,
        "year": human_row["year"],
        "field": human_row["field"],
        "word_count": len(text.split()),
        "label": "mixed",
        "generator": model,
        "prompt_variant": "polish",
    }
