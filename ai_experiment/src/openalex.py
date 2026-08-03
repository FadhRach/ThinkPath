"""Ambil abstrak akademik berbahasa Indonesia dari OpenAlex.

Kenapa OpenAlex dan bukan scraping: datanya terbuka (CC0), ada API resmi tanpa
kunci, dan bisa difilter langsung berdasarkan bahasa serta tanggal terbit. Tidak
perlu menembus robots.txt siapa pun.

Kenapa dibatasi terbit sebelum November 2022: itulah cara mendapatkan label
"manusia" yang dijamin benar tanpa satu pun anotator. Bukan karena tulisan lama
lebih baik. Tulisan manusia tidak berubah sejak 2022.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from typing import Iterator

import requests

from .config import (
    BACKOFF_BASE_SECONDS,
    HUMAN_CUTOFF_DATE,
    HUMAN_START_DATE,
    MAX_RETRIES,
    MAX_WORDS,
    MIN_WORDS,
    OPENALEX_MAILTO,
    OPENALEX_URL,
    REQUEST_TIMEOUT,
)

# Abstrak OpenAlex kadang menyisakan penanda seksi dari parser aslinya.
BOILERPLATE = re.compile(
    r"^\s*(abstrak|abstract|ringkasan|intisari)\s*[:.\-]?\s*", re.IGNORECASE
)
WHITESPACE = re.compile(r"\s+")

# OpenAlex memuat buku yang "abstrak"-nya sebenarnya daftar isi. Teks seperti
# "Bab 1 : ... Bab 2 : ..." bukan prosa, dan kalau lolos akan mengajari detektor
# hal yang salah. Pola ini menangkapnya.
TOC_PATTERN = re.compile(r"\b(bab|chapter)\s+\d", re.IGNORECASE)
SENTENCE_END = re.compile(r"[.!?]")


def rebuild_abstract(inverted_index: dict | None) -> str:
    """Susun ulang abstrak dari inverted index milik OpenAlex.

    OpenAlex menyimpan abstrak sebagai peta kata ke daftar posisi, bukan sebagai
    teks utuh. Fungsi ini mengembalikannya ke urutan semula.
    """
    if not inverted_index:
        return ""
    positions: list[tuple[int, str]] = []
    for word, spots in inverted_index.items():
        for spot in spots:
            positions.append((spot, word))
    positions.sort(key=lambda pair: pair[0])
    return " ".join(word for _, word in positions)


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = BOILERPLATE.sub("", text)
    return WHITESPACE.sub(" ", text).strip()


def looks_like_prose(text: str) -> bool:
    """Tolak teks yang bukan paragraf mengalir.

    Yang disaring: daftar isi buku, daftar berpoin, dan hasil parse yang gagal.
    Ciri utamanya sedikit tanda akhir kalimat dan banyak titik dua, karena
    daftar tidak diakhiri titik.
    """
    words = len(text.split())
    if words == 0:
        return False
    if len(TOC_PATTERN.findall(text)) >= 3:
        return False
    sentences = len(SENTENCE_END.findall(text))
    if sentences < 3:
        return False
    # Rata rata kalimat lebih dari 60 kata praktis mustahil untuk prosa nyata.
    if words / sentences > 60:
        return False
    if text.count(":") > words / 25:
        return False
    return True


def title_key(title: str) -> str:
    """Kunci deduplikasi. OpenAlex kerap memuat entri ganda untuk satu karya."""
    lowered = unicodedata.normalize("NFKC", title or "").lower()
    return re.sub(r"[^a-z0-9]+", "", lowered)


def _get_with_retry(params: dict) -> dict:
    """GET dengan backoff eksponensial untuk 429 dan galat server."""
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(
                OPENALEX_URL, params=params, timeout=REQUEST_TIMEOUT
            )
            if response.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"status {response.status_code}")
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(BACKOFF_BASE_SECONDS * (2**attempt))
    raise RuntimeError(f"OpenAlex gagal setelah {MAX_RETRIES} percobaan: {last_error}")


def _field_of(work: dict) -> str:
    """Bidang ilmu, dipakai untuk memisah train dan test tanpa bocor topik."""
    topic = work.get("primary_topic") or {}
    field = (topic.get("field") or {}).get("display_name")
    return field or "Tidak diketahui"


def fetch_human_abstracts(target: int, per_page: int = 200) -> Iterator[dict]:
    """Hasilkan abstrak manusia satu per satu sampai mencapai target.

    Dedup dilakukan di sini supaya pemanggil tidak perlu memikirkannya.
    """
    params = {
        # type:article membuang buku dan bab buku, yang "abstrak"-nya sering
        # hanya daftar isi.
        "filter": (
            f"language:id,"
            f"type:article,"
            f"from_publication_date:{HUMAN_START_DATE},"
            f"to_publication_date:{HUMAN_CUTOFF_DATE},"
            f"has_abstract:true"
        ),
        "per_page": str(per_page),
        "cursor": "*",
        "select": "id,title,publication_year,abstract_inverted_index,primary_topic",
    }
    if OPENALEX_MAILTO:
        params["mailto"] = OPENALEX_MAILTO

    seen: set[str] = set()
    produced = 0

    while produced < target:
        payload = _get_with_retry(params)
        results = payload.get("results") or []
        if not results:
            return

        for work in results:
            title = (work.get("title") or "").strip()
            if not title:
                continue
            key = title_key(title)
            if key in seen:
                continue

            text = normalize_text(
                rebuild_abstract(work.get("abstract_inverted_index"))
            )
            word_count = len(text.split())
            if word_count < MIN_WORDS or word_count > MAX_WORDS:
                continue
            if not looks_like_prose(text):
                continue

            seen.add(key)
            produced += 1
            yield {
                "openalex_id": work.get("id", ""),
                "title": title,
                "text": text,
                "year": work.get("publication_year"),
                "field": _field_of(work),
                "word_count": word_count,
                "label": "human",
                "generator": "",
                "prompt_variant": "",
            }
            if produced >= target:
                return

        cursor = (payload.get("meta") or {}).get("next_cursor")
        if not cursor:
            return
        params["cursor"] = cursor
