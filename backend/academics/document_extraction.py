"""Ekstraksi teks dari dokumen yang diunggah mahasiswa (OCR).

Alur: PDF dicoba lewat lapisan teks native dulu (PyMuPDF, gratis dan presisi,
tanpa dependensi sistem apa pun - pip wheel murni yang membundel MuPDF
sendiri). Halaman yang tidak punya lapisan teks yang layak (hasil scan, foto,
tulisan tangan) dirender jadi gambar lalu dikirim ke model visual Groq.
Ekstraksi dilakukan PER HALAMAN, bukan per dokumen, supaya panggilan model
visual hanya terpakai untuk halaman yang benar benar membutuhkannya - akun
Groq yang sama juga melayani run_analysis() untuk SETIAP submission di
aplikasi ini (lihat llm.py), jadi jatah hariannya dibagi berdua.

Modul ini murni transformasi blob_url -> teks. Tidak ada tulis basis data di
sini sama sekali: endpoint yang memanggilnya (views.DocumentExtractView) tidak
membuat Submission apa pun, sesuai keputusan produk "unggah tidak pernah
auto-submit" - mahasiswa selalu meninjau hasil ekstraksi di editor sebelum
submit sungguhan lewat SubmissionListView seperti biasa.

Berbeda dari rantai skor AI (llm.py) yang selalu punya lapisan cadangan
berikutnya, modul ini TIDAK punya fallback heuristik diam diam. Kegagalan
ekstraksi harus tampil sebagai error yang jelas - mahasiswa selalu punya jalan
mundur mengetik langsung di editor yang sama, jadi tidak ada alasan
mengembalikan teks yang mungkin sampah tanpa memberi tahu penggunanya.
"""
from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass, field

import pymupdf
import requests

logger = logging.getLogger(__name__)

# 15 MB. Cukup untuk PDF/foto tugas yang realistis, cukup kecil untuk tidak
# membebani fetch server-side maupun memori satu invokasi fungsi.
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

# ai_experiment/README.md mencatat jatah gratis Groq llama-3.3-70b-versatile
# sekitar 100.000 token/hari (~64 panggilan analisis). Akun yang sama melayani
# run_analysis() untuk SETIAP submission di seluruh aplikasi, jadi panggilan
# vision OCR berebut jatah harian yang sama dengan jalur skor utama. Batas
# halaman ini menjaga satu unggahan tidak bisa menghabiskan jatah harian
# sendirian; digabung dengan "coba lapisan teks dulu" di atas, panggilan
# vision hanya terpakai untuk halaman yang benar benar berupa scan/gambar.
MAX_PAGES = 8

SUPPORTED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}

FETCH_TIMEOUT_SECONDS = 30
VISION_REQUEST_TIMEOUT_SECONDS = 30

# Di bawah jumlah karakter ini, lapisan teks PDF dianggap tidak ada (halaman
# kosong, atau sisa artefak font tanpa isi nyata) dan halaman dilempar ke
# jalur visual, bukan diterima apa adanya.
MIN_CHARS_PER_PAGE_FOR_TEXT_LAYER = 20

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# PENTING: verifikasi id model visual Groq yang berlaku saat model ini benar
# benar dipanggil produksi. Katalog model Groq berubah dari waktu ke waktu,
# dan menebak nama model di sini dengan yakin bisa diam diam memanggil model
# yang sudah tidak ada. Tidak ada default hardcoded yang "pasti benar" -
# GROQ_VISION_MODEL wajib diisi lewat environment.
VISION_PROMPT = """Kamu membaca satu halaman dokumen tulisan tangan atau hasil scan jawaban tugas mahasiswa Indonesia. Transkripsikan SELURUH teks yang terlihat, termasuk tabel dan daftar berpoin, apa adanya tanpa menambah atau menafsirkan ulang isinya.

Aturan format yang WAJIB diikuti:
1. Setiap paragraf, item daftar, dan baris tabel yang kamu transkrip HARUS diakhiri tanda baca kalimat (titik, tanda seru, atau tanda tanya) walau aslinya tidak ada di tulisan tangan. Ini bukan soal gaya - sistem di belakang memecah kalimat murni dari tanda baca akhir, bukan dari baris baru, jadi tanpa titik penutup satu daftar berpoin akan terbaca sebagai satu kalimat raksasa.
2. Item daftar ditulis satu baris satu item, diawali "- ".
3. Baris tabel ditulis sebagai kalimat naratif yang menyebut nilai tiap kolom, bukan dipisah karakter tabulasi.
4. Kalau ada bagian yang benar benar tidak terbaca, tulis [tidak terbaca] di posisi itu, jangan mengarang isinya.

Keluarkan HANYA teks hasil transkripsi, tanpa komentar, tanpa markdown, tanpa penjelasan tambahan."""


@dataclass(frozen=True)
class ExtractionResult:
    text: str
    page_count: int
    extraction_method: str  # "pdf_text_layer" | "vision_llm" | "mixed"
    warnings: list[str] = field(default_factory=list)


class ExtractionError(Exception):
    """code: "unsupported_type" | "too_large" | "too_many_pages" | "failed" """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def fetch_blob(blob_url: str) -> bytes:
    """Ambil berkas dari Vercel Blob secara outbound.

    Batas 4,5 MB milik Vercel Function hanya berlaku untuk body request yang
    MASUK - ini panggilan keluar dari server, jadi tidak terikat batas itu.
    MAX_FILE_SIZE_BYTES tetap dijaga di sini sebagai pagar sendiri supaya satu
    unggahan tidak bisa membengkakkan memori/waktu satu invokasi.
    """
    response = requests.get(blob_url, timeout=FETCH_TIMEOUT_SECONDS, stream=True)
    response.raise_for_status()

    chunks: list[bytes] = []
    total = 0
    for chunk in response.iter_content(chunk_size=1024 * 256):
        total += len(chunk)
        if total > MAX_FILE_SIZE_BYTES:
            raise ExtractionError("too_large", "Berkas melebihi 15 MB.")
        chunks.append(chunk)
    return b"".join(chunks)


def extract_page_text_layer(page: "pymupdf.Page") -> str | None:
    text = page.get_text().strip()
    if len(text) < MIN_CHARS_PER_PAGE_FOR_TEXT_LAYER:
        return None
    return text


def rasterize_page(page: "pymupdf.Page", dpi: int = 150) -> bytes:
    pixmap = page.get_pixmap(dpi=dpi)
    return pixmap.tobytes("png")


def call_vision_llm(image_bytes: bytes, mime: str) -> str:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_VISION_MODEL", "").strip()
    if not api_key or not model:
        raise ExtractionError(
            "failed",
            "Model visual belum dikonfigurasi. Coba ketik jawabanmu langsung.",
        )

    encoded = base64.b64encode(image_bytes).decode("ascii")
    try:
        response = requests.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": VISION_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{encoded}"},
                            },
                        ],
                    }
                ],
                "temperature": 0.1,
            },
            timeout=VISION_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.warning("Panggilan model visual gagal: %s", exc)
        raise ExtractionError(
            "failed", "Gagal membaca dokumen. Coba unggah ulang atau ketik jawabanmu langsung."
        ) from exc

    text = content.strip()
    if not text:
        raise ExtractionError(
            "failed", "Gagal membaca dokumen. Coba unggah ulang atau ketik jawabanmu langsung."
        )
    return text


def _extract_pdf(data: bytes) -> ExtractionResult:
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # PyMuPDF melempar berbagai tipe untuk berkas rusak
        raise ExtractionError(
            "failed", "Gagal membaca dokumen. Coba unggah ulang atau ketik jawabanmu langsung."
        ) from exc

    if document.page_count > MAX_PAGES:
        raise ExtractionError(
            "too_many_pages", f"Dokumen melebihi {MAX_PAGES} halaman."
        )

    page_texts: list[str] = []
    methods_used: set[str] = set()
    warnings: list[str] = []

    for index in range(document.page_count):
        page = document.load_page(index)
        layer_text = extract_page_text_layer(page)
        if layer_text is not None:
            page_texts.append(layer_text)
            methods_used.add("pdf_text_layer")
            continue

        try:
            image_bytes = rasterize_page(page)
            page_texts.append(call_vision_llm(image_bytes, "image/png"))
            methods_used.add("vision_llm")
        except ExtractionError:
            warnings.append(f"Halaman {index + 1} sulit dibaca, mohon periksa kembali hasilnya.")

    if not page_texts:
        raise ExtractionError(
            "failed", "Gagal membaca dokumen. Coba unggah ulang atau ketik jawabanmu langsung."
        )

    if methods_used == {"pdf_text_layer"}:
        extraction_method = "pdf_text_layer"
    elif methods_used == {"vision_llm"}:
        extraction_method = "vision_llm"
    else:
        extraction_method = "mixed"

    return ExtractionResult(
        text="\n\n".join(page_texts),
        page_count=document.page_count,
        extraction_method=extraction_method,
        warnings=warnings,
    )


def _extract_image(data: bytes, content_type: str) -> ExtractionResult:
    text = call_vision_llm(data, content_type)
    return ExtractionResult(text=text, page_count=1, extraction_method="vision_llm")


def extract_document(*, blob_url: str, content_type: str, filename: str) -> ExtractionResult:
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise ExtractionError("unsupported_type", "Jenis berkas tidak didukung.")

    data = fetch_blob(blob_url)

    if content_type == "application/pdf":
        return _extract_pdf(data)
    return _extract_image(data, content_type)
