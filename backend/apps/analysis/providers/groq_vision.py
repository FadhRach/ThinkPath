"""Klien Groq untuk membaca teks dari gambar (OCR lewat model visual).

Dipisah dari groq.py karena permintaannya berbeda (gambar, bukan JSON skor)
dan model-nya pun berbeda. Memakai kunci Groq yang sama dengan penilaian.
"""
from __future__ import annotations

import base64
import os

import requests

from apps.analysis.providers.groq import GROQ_API_URL

# Katalog Groq berubah (llama-4-scout sudah hilang); qwen ini diuji menerima
# gambar pada Oktober 2026. Ganti lewat GROQ_VISION_MODEL bila dipensiunkan.
DEFAULT_MODEL = "qwen/qwen3.8-27b"
# Beberapa halaman dibaca paralel dan seluruh request harus selesai jauh
# sebelum timeout gunicorn (60 detik).
REQUEST_TIMEOUT_SECONDS = 20

# Titik penutup wajib: analisis teks memecah kalimat dari tanda baca akhir,
# bukan dari baris baru, jadi daftar berpoin tanpa titik terbaca satu kalimat.
PROMPT = """Transkripsikan SELURUH teks pada gambar halaman tugas mahasiswa Indonesia ini, apa adanya tanpa menambah, merangkum, atau menafsirkan.

Aturan:
1. Akhiri setiap paragraf, item daftar, dan baris tabel dengan tanda baca kalimat (titik, tanda seru, atau tanda tanya) walau aslinya tidak ada.
2. Item daftar satu baris satu item, diawali "- ".
3. Baris tabel ditulis sebagai kalimat yang menyebut nilai tiap kolom.
4. Bagian yang tidak terbaca ditulis [tidak terbaca]; jangan mengarang isinya.

Keluarkan HANYA teks hasil transkripsi, tanpa komentar atau markdown."""


def transcribe(image_bytes: bytes, mime: str) -> str:
    """Teks pada gambar. Melempar requests.RequestException/ValueError bila gagal."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    encoded = base64.b64encode(image_bytes).decode("ascii")
    response = requests.post(
        GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": os.getenv("GROQ_VISION_MODEL") or DEFAULT_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}},
                    ],
                }
            ],
            "temperature": 0.1,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    text = (response.json()["choices"][0]["message"]["content"] or "").strip()
    if not text:
        raise ValueError("Model visual tidak mengembalikan teks.")
    return text
