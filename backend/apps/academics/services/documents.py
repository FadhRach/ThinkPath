"""Unggah dokumen jawaban: validasi, ekstraksi teks (OCR), dan penyimpanan.

Hasil ekstraksi hanya dikembalikan ke mahasiswa untuk ditinjau di editor;
unggahan tidak pernah membuat Submission. Berkas asli dan teks hasilnya
disimpan berdampingan di MEDIA_ROOT (backend/data/media):

    documents/<id mahasiswa>/<id dokumen>.<pdf|png|jpg|docx>
    documents/<id mahasiswa>/<id dokumen>.txt

Teks yang tersimpan juga menjadi bukti: verified_source() memeriksa bahwa
jawaban yang dikumpulkan memang berasal dari dokumen itu, sehingga klaim
"diimpor dari dokumen" tidak bisa dipakai menghindari forensik proses.

Jalur ekstraksi:
- DOCX dan PDF berlapis teks dibaca di server (gratis, tanpa kirim data keluar).
- Halaman gambar (scan, foto, tulisan tangan) dibaca model visual Groq, jadi
  hanya jalan bila mahasiswa mengizinkan analisis di luar negeri.
"""
from __future__ import annotations

import io
import logging
import re
import uuid
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from uuid import UUID
from xml.etree import ElementTree

import pymupdf
import requests
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.exceptions import ValidationError

from apps.analysis.providers import groq, groq_vision

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PAGES = 20
# Halaman gambar dibaca paralel; 6 halaman / 3 pekerja x timeout 20 detik
# tetap di bawah timeout gunicorn (60 detik).
MAX_OCR_PAGES = 6
OCR_WORKERS = 3
# Halaman dengan teks lebih pendek dari ini dianggap tidak punya lapisan teks.
MIN_TEXT_CHARS = 20
# Sisi terpanjang gambar yang dikirim ke model. Foto ponsel 8 MB jadi ~0,5 MB,
# di bawah batas 4 MB (base64) milik Groq.
OCR_IMAGE_MAX_SIDE = 1800
# Teks 10 MB DOCX dengan puluhan halaman sudah di bawah 4 MB XML. Batas lama 20 MB
# bisa menghabiskan sebagian besar memori container (320 MB) bersama pohon XML-nya.
DOCX_MAX_XML_BYTES = 4 * 1024 * 1024
# Bagian kata jawaban yang harus ada di teks dokumen agar dianggap berasal darinya.
SOURCE_MATCH_RATIO = 0.5

WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
EXTENSIONS = {"pdf": "pdf", "png": "png", "jpeg": "jpg", "docx": "docx"}
CONTENT_TYPES = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
UNSUPPORTED = "Jenis berkas tidak didukung. Unggah PDF, DOCX, PNG, atau JPG."
UNREADABLE = "Tidak ada teks yang bisa dibaca dari dokumen ini. Coba berkas lain atau ketik jawabanmu."


@dataclass(frozen=True)
class Extraction:
    text: str
    page_count: int
    method: str  # "text" (dibaca di server), "ocr" (model visual), atau "mixed"
    warnings: list[str] = field(default_factory=list)


# Blok PDF sependek ini dianggap judul.
HEADING_MAX_WORDS = 6


def _close_sentence(text: str, *, heading: bool = False) -> str:
    """Analisis memecah kalimat dari tanda baca akhir, bukan dari baris baru.

    Judul dibiarkan tanpa titik: titik paksa menjadikannya "kalimat" pendek yang
    membuat variasi panjang kalimat tampak lebih manusiawi daripada aslinya.
    """
    text = " ".join(text.split())
    return text if heading or not text or text[-1] in ".!?:;" else text + "."


def _page_paragraphs(blocks: list[str]) -> str:
    """Blok teks PDF menjadi paragraf: sambung blok yang memotong kalimat, tutup sisanya."""
    merged: list[str] = []
    for block in blocks:
        # Blok berikutnya berawalan huruf kecil: kalimat yang sama, bukan paragraf baru.
        if merged and merged[-1][-1] not in ".!?:;" and block[0].islower():
            merged[-1] += " " + block
        else:
            merged.append(block)
    closed = (_close_sentence(m, heading=len(m.split()) <= HEADING_MAX_WORDS) for m in merged)
    return "\n\n".join(filter(None, closed))


# Simbol daftar dari Word/PDF (termasuk glyph font Symbol/Wingdings di area privat Unicode).
# Di dokumen ia hanya format daftar, bukan sisa salinan obrolan: tanpa dibuang, mahasiswa
# yang menulis daftar berpoin di Word ikut tertandai "simbol poin khas obrolan".
_LIST_GLYPH = re.compile(r"^\s*[•‣▪◦➤➢✔✓➜·\uf0a7\uf0b7\uf076\uf0d8\uf0fc]+\s*", re.MULTILINE)


def _strip_list_glyphs(text: str) -> str:
    return _LIST_GLYPH.sub("", text)


def _drop_repeated(pages: list[list[str]]) -> list[list[str]]:
    """Buang kepala/kaki halaman: blok yang sama (selain angka) di separuh halaman atau lebih."""
    if len(pages) < 2:
        return pages
    key = lambda block: re.sub(r"\d+", "#", block.lower())  # noqa: E731
    seen = Counter(k for page in pages for k in {key(b) for b in page})
    return [[b for b in page if seen[key(b)] < max(2, len(pages) / 2)] for page in pages]


def _is_docx(data: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            return "word/document.xml" in archive.namelist()
    except zipfile.BadZipFile:
        return False


def detect_kind(data: bytes) -> str:
    """Jenis berkas dari isinya; nama dan content-type kiriman klien tidak dipercaya."""
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"PK\x03\x04") and _is_docx(data):
        return "docx"
    raise ValidationError(UNSUPPORTED)


def _extract_docx(data: bytes) -> Extraction:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            # Batas ukuran terurai: berkas zip kecil bisa mengembang jadi gigabita.
            if archive.getinfo("word/document.xml").file_size > DOCX_MAX_XML_BYTES:
                raise ValidationError("Dokumen terlalu besar untuk dibaca.")
            xml = archive.read("word/document.xml")
            # DOCX sah tidak memakai DTD. Menolaknya menutup serangan entitas
            # bersarang ("billion laughs") tanpa menambah dependensi.
            if b"<!DOCTYPE" in xml[:2048] or b"<!ENTITY" in xml[:2048]:
                raise ValidationError(UNREADABLE)
            root = ElementTree.fromstring(xml)
    except (zipfile.BadZipFile, ElementTree.ParseError) as exc:
        raise ValidationError(UNREADABLE) from exc

    paragraphs = []
    for paragraph in root.iter(f"{WORD_NS}p"):
        text = "".join(
            (node.text or "") if node.tag == f"{WORD_NS}t" else " "
            for node in paragraph.iter()
            if node.tag in (f"{WORD_NS}t", f"{WORD_NS}tab", f"{WORD_NS}br")
        )
        style = paragraph.find(f"{WORD_NS}pPr/{WORD_NS}pStyle")
        style_id = style.get(f"{WORD_NS}val", "") if style is not None else ""
        if closed := _close_sentence(text, heading=style_id.startswith(("Heading", "Title"))):
            paragraphs.append(closed)
    return Extraction("\n\n".join(paragraphs), page_count=1, method="text")


def _render_jpeg(page: pymupdf.Page) -> bytes:
    zoom = OCR_IMAGE_MAX_SIDE / max(page.rect.width, page.rect.height)
    return page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).tobytes("jpeg")


def _ocr(images: list[bytes]) -> list[str | None]:
    def read(image: bytes) -> str | None:
        try:
            return groq_vision.transcribe(image, "image/jpeg")
        except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
            logger.warning("OCR satu halaman gagal: %s", exc)
            return None

    with ThreadPoolExecutor(max_workers=OCR_WORKERS) as pool:
        return list(pool.map(read, images))


def _extract_pages(data: bytes, kind: str, *, allow_external: bool) -> Extraction:
    """PDF dan gambar lewat satu jalur: gambar adalah dokumen satu halaman."""
    try:
        document = pymupdf.open(stream=data, filetype=EXTENSIONS[kind])
    except Exception as exc:  # PyMuPDF memakai banyak tipe galat untuk berkas rusak
        raise ValidationError(UNREADABLE) from exc
    if document.page_count > MAX_PAGES:
        raise ValidationError(f"Dokumen melebihi {MAX_PAGES} halaman.")

    pages = _drop_repeated(
        [
            [text for block in page.get_text("blocks", sort=True) if block[6] == 0 and (text := " ".join(_strip_list_glyphs(block[4]).split()))]
            for page in document
        ]
    )
    texts: dict[int, str] = {}
    scanned: list[int] = []
    for index, blocks in enumerate(pages):
        text = _page_paragraphs(blocks)
        if len(text) >= MIN_TEXT_CHARS:
            texts[index] = text
        else:
            scanned.append(index)

    warnings: list[str] = []
    if scanned:
        if len(scanned) > MAX_OCR_PAGES:
            raise ValidationError(f"Halaman scan atau gambar maksimal {MAX_OCR_PAGES} per dokumen.")
        if not allow_external:
            raise ValidationError(
                "Dokumen ini berisi gambar yang dibaca layanan analisis di luar negeri (Groq). "
                "Persetujuanmu belum mencakup analisis itu: setujui Kebijakan Privasi versi terbaru, atau ketik jawabanmu."
            )
        if not groq.is_configured():
            raise ValidationError("Pembacaan gambar belum tersedia di server ini. Ketik jawabanmu.")
        # Pixmap dirender di thread ini: PyMuPDF tidak aman dipakai lintas thread.
        for index, text in zip(scanned, _ocr([_render_jpeg(document[i]) for i in scanned])):
            if text:
                texts[index] = _strip_list_glyphs(text)
            else:
                warnings.append(f"Halaman {index + 1} gagal dibaca, periksa hasilnya.")

    read_by_ocr = len(scanned) - len(warnings)
    read_as_text = len(texts) - read_by_ocr
    method = "mixed" if read_by_ocr and read_as_text else "ocr" if read_by_ocr else "text"
    return Extraction(
        "\n\n".join(texts[i] for i in sorted(texts)),
        page_count=document.page_count,
        method=method,
        warnings=warnings,
    )


def extract(data: bytes, kind: str, *, allow_external: bool) -> Extraction:
    result = (
        _extract_docx(data)
        if kind == "docx"
        else _extract_pages(data, kind, allow_external=allow_external)
    )
    if not result.text.strip():
        raise ValidationError(UNREADABLE)
    return result


def import_document(upload, student_id: UUID, *, allow_external: bool) -> tuple[UUID, Extraction]:
    """Validasi, ekstrak, lalu simpan berkas dan teksnya. Mengembalikan id dokumen."""
    if upload.size > MAX_FILE_BYTES:
        raise ValidationError(f"Ukuran berkas maksimal {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    data = upload.read()
    kind = detect_kind(data)
    result = extract(data, kind, allow_external=allow_external)

    document_id = uuid.uuid4()
    base = f"documents/{student_id}/{document_id}"
    default_storage.save(f"{base}.{EXTENSIONS[kind]}", ContentFile(data))
    default_storage.save(f"{base}.txt", ContentFile(result.text.encode("utf-8")))
    return document_id, result


def original_exists(student_id: UUID, document_id: UUID) -> bool:
    """Apakah berkas asli masih ada di penyimpanan (tanpa membukanya)."""
    try:
        _, names = default_storage.listdir(f"documents/{student_id}")
    except FileNotFoundError:
        return False
    return any(name.rpartition(".")[0] == str(document_id) and not name.endswith(".txt") for name in names)


def open_original(student_id: UUID, document_id: UUID):
    """(berkas terbuka, content-type) dari unggahan asli, atau None bila tidak ada."""
    folder = f"documents/{student_id}"
    try:
        _, names = default_storage.listdir(folder)
    except FileNotFoundError:
        return None
    for name in names:
        stem, _, ext = name.rpartition(".")
        if stem == str(document_id) and ext in CONTENT_TYPES:
            return default_storage.open(f"{folder}/{name}"), CONTENT_TYPES[ext]
    return None


def read_text(student_id: UUID, document_id: UUID) -> str | None:
    """Teks hasil baca dokumen yang tersimpan, atau None bila berkasnya tidak ada."""
    try:
        with default_storage.open(f"documents/{student_id}/{document_id}.txt") as stored:
            return stored.read().decode("utf-8")
    except FileNotFoundError:
        return None


def combine_with_document(typed: str, document_text: str) -> str:
    """Ketikan mahasiswa (nama, NIM, catatan) lalu isi dokumen: satu teks untuk dianalisis."""
    typed = typed.strip()
    return f"{typed}\n\n{document_text}" if typed else document_text


def verified_source(student_id: UUID, document_id: UUID | None, text: str) -> UUID | None:
    """document_id bila teks jawaban memang berasal dari dokumen milik mahasiswa itu."""
    if document_id is None:
        return None
    try:
        with default_storage.open(f"documents/{student_id}/{document_id}.txt") as stored:
            source = Counter(stored.read().decode("utf-8").lower().split())
    except FileNotFoundError:
        return None
    answer = Counter(text.lower().split())
    shared = sum((answer & source).values())
    return document_id if shared >= SOURCE_MATCH_RATIO * sum(answer.values()) else None
