"""Jawaban kaya (editor TipTap/ProseMirror): validasi, pembersihan, dan teks polos.

Klien mengirim dokumen JSON. Server TIDAK pernah mempercayainya apa adanya:
  1. `clean_rich_doc` membangun ulang dokumen hanya dari simpul dan tanda yang diizinkan,
     dengan atribut yang disaring. Tidak ada HTML mentah, jadi tidak ada jalur XSS lewat
     jawaban; peramban merenderkannya kembali lewat skema editor.
  2. `rich_to_plain` mengambil teks polos DARI dokumen yang sudah bersih. Teks inilah yang
     dianalisis (detektor AI, level Bloom, jumlah kata proses). Klien tidak boleh mengirim
     teks polos yang berbeda dari tampilan yang dilihat dosen.

Rumus dan gambar tidak masuk teks polos: bukan prosa, dan rumus LaTeX hanya menambah derau
pada detektor. Gambar disisipkan sebagai data URI kecil (dikompres klien), jadi ikut terhapus
bersama jawabannya dan tidak butuh penyimpanan berkas baru.
"""
from __future__ import annotations

import json
import re
from typing import Any

from rest_framework.exceptions import ValidationError

MAX_DEPTH = 12
MAX_NODES = 6_000
MAX_JSON_BYTES = 2_500_000
MAX_IMAGES = 6
MAX_IMAGE_CHARS = 700_000
MAX_LATEX_CHARS = 2_000
MAX_TEXT_NODE_CHARS = 20_000

_IMAGE_SRC = re.compile(r"^data:image/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$")
_LINK_SCHEMES = ("http://", "https://", "mailto:")

BLOCK_NODES = {
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
    "codeBlock",
    "horizontalRule",
    "table",
    "tableRow",
    "tableCell",
    "tableHeader",
    "blockMath",
}
INLINE_NODES = {"text", "hardBreak", "inlineMath", "image"}
ALLOWED_NODES = BLOCK_NODES | INLINE_NODES
ALLOWED_MARKS = {"bold", "italic", "underline", "strike", "code", "link"}


class _Budget:
    def __init__(self) -> None:
        self.nodes = 0
        self.images = 0


def _int(value: Any, low: int, high: int, default: int) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and low <= value <= high else default


def _attrs(node_type: str, raw: Any, budget: _Budget) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    if node_type == "heading":
        return {"level": _int(raw.get("level"), 1, 3, 2)}
    if node_type == "orderedList":
        return {"start": _int(raw.get("start"), 1, 10_000, 1)}
    if node_type == "codeBlock":
        language = raw.get("language")
        return {"language": language[:30]} if isinstance(language, str) else {}
    if node_type in ("tableCell", "tableHeader"):
        return {
            "colspan": _int(raw.get("colspan"), 1, 20, 1),
            "rowspan": _int(raw.get("rowspan"), 1, 20, 1),
        }
    if node_type in ("inlineMath", "blockMath"):
        latex = raw.get("latex")
        if not isinstance(latex, str) or len(latex) > MAX_LATEX_CHARS:
            raise ValidationError("Rumus terlalu panjang atau tidak valid.")
        return {"latex": latex}
    if node_type == "image":
        src = raw.get("src")
        if not isinstance(src, str) or len(src) > MAX_IMAGE_CHARS or not _IMAGE_SRC.match(src):
            raise ValidationError("Gambar harus berupa PNG, JPEG, WebP, atau GIF yang berukuran kecil.")
        budget.images += 1
        if budget.images > MAX_IMAGES:
            raise ValidationError(f"Maksimal {MAX_IMAGES} gambar dalam satu jawaban.")
        alt = raw.get("alt")
        return {"src": src, "alt": alt[:200] if isinstance(alt, str) else ""}
    return {}


def _clean_marks(raw: Any) -> list[dict]:
    marks: list[dict] = []
    for mark in raw if isinstance(raw, list) else []:
        if not isinstance(mark, dict) or mark.get("type") not in ALLOWED_MARKS:
            raise ValidationError("Format teks tidak dikenali.")
        cleaned: dict = {"type": mark["type"]}
        if mark["type"] == "link":
            href = (mark.get("attrs") or {}).get("href")
            if not isinstance(href, str) or not href.lower().startswith(_LINK_SCHEMES) or len(href) > 2_000:
                raise ValidationError("Tautan harus diawali http://, https://, atau mailto:.")
            cleaned["attrs"] = {"href": href}
        marks.append(cleaned)
    return marks


def _clean_node(node: Any, depth: int, budget: _Budget) -> dict:
    if depth > MAX_DEPTH:
        raise ValidationError("Struktur jawaban terlalu bersarang.")
    if not isinstance(node, dict) or node.get("type") not in ALLOWED_NODES:
        raise ValidationError("Isi jawaban memuat elemen yang tidak didukung.")
    budget.nodes += 1
    if budget.nodes > MAX_NODES:
        raise ValidationError("Jawaban terlalu rumit.")
    node_type = node["type"]
    cleaned: dict = {"type": node_type}
    if node_type == "text":
        text = node.get("text")
        if not isinstance(text, str) or len(text) > MAX_TEXT_NODE_CHARS:
            raise ValidationError("Teks tidak valid.")
        cleaned["text"] = text
        marks = _clean_marks(node.get("marks"))
        if marks:
            cleaned["marks"] = marks
        return cleaned
    attrs = _attrs(node_type, node.get("attrs"), budget)
    if attrs:
        cleaned["attrs"] = attrs
    children = node.get("content")
    if children is not None:
        if not isinstance(children, list):
            raise ValidationError("Isi jawaban tidak valid.")
        cleaned["content"] = [_clean_node(child, depth + 1, budget) for child in children]
    return cleaned


def clean_rich_doc(doc: Any) -> dict:
    """Dokumen bersih hasil bangun ulang, atau ValidationError."""
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        raise ValidationError("Format jawaban tidak valid.")
    if len(json.dumps(doc, ensure_ascii=False)) > MAX_JSON_BYTES:
        raise ValidationError("Jawaban terlalu besar. Kecilkan atau kurangi gambar.")
    budget = _Budget()
    children = doc.get("content") or []
    if not isinstance(children, list):
        raise ValidationError("Isi jawaban tidak valid.")
    return {"type": "doc", "content": [_clean_node(child, 1, budget) for child in children]}


def _inline_text(node: dict) -> str:
    kind = node["type"]
    if kind == "text":
        return node["text"]
    if kind == "hardBreak":
        return "\n"
    return ""  # rumus dan gambar


def _plain_lines(node: dict) -> list[str]:
    kind = node["type"]
    children = node.get("content", [])
    if kind in ("paragraph", "heading", "codeBlock"):
        return ["".join(_inline_text(child) for child in children)]
    if kind in ("tableCell", "tableHeader"):
        return [" ".join(line for child in children for line in _plain_lines(child) if line)]
    if kind == "tableRow":
        # Anak yang tidak menghasilkan baris (mis. bukan sel) dibaca sebagai sel kosong.
        cells = [next(iter(_plain_lines(child)), "") for child in children]
        return ["\t".join(cells)]
    if kind in ("blockMath", "horizontalRule"):
        return []
    lines: list[str] = []
    for child in children:
        lines.extend(_plain_lines(child))
    return lines


def rich_to_plain(doc: dict) -> str:
    """Teks polos dokumen bersih; satu baris kosong di antara blok tingkat atas."""
    blocks = ["\n".join(_plain_lines(child)) for child in doc.get("content", [])]
    return "\n\n".join(block for block in blocks if block.strip()).strip()
