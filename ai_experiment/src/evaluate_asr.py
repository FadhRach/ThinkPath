"""Membandingkan model ASR untuk Cek Paham: WER, CER, istilah kunci, latensi, halusinasi.

Masukan: data/asr_clips/manifest.csv + berkas audio (lihat protocol/cekpaham_clip_recording.md).
Dipakai oleh notebooks/06_cekpaham_asr_dan_penilai.ipynb.

Hasil per (model, klip) disimpan di cache JSONL dengan kunci yang memuat nama model
dan isi berkas, jadi menjalankan ulang tidak membayar dua kali dan berhenti anggun
saat kuota Groq habis. Keputusan model ASR mengacu pada laporan ini, bukan angka vendor.
"""
from __future__ import annotations

import csv
import hashlib
import statistics
from pathlib import Path

from .asr import wer
from .asr.adapters import AsrResult, QuotaExhausted
from .config import CACHE_DIR
from .evaluation import JsonCache, ScoreCache

CACHE = JsonCache(CACHE_DIR / "asr_results.jsonl")
DEFAULT_ADAPTERS = ("groq-turbo", "groq-large-v3", "faster-whisper-small")
GROUPS = ("language", "device", "noise", "style")
SILENT_STYLE = "silence"
AUDIO_SUFFIXES = (".webm", ".ogg", ".mp4", ".m4a", ".mp3", ".wav")
MIN_GROUP_FOR_CI = 5


def read_manifest(clips_dir: Path) -> list[dict]:
    with (clips_dir / "manifest.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["keyterms"] = [t.strip() for t in row.get("keyterms", "").split("|") if t.strip()]
        row["duration_s"] = float(row.get("duration_s") or 0)
        matches = [p for p in clips_dir.glob(f"{row['clip_id']}.*") if p.suffix.lower() in AUDIO_SUFFIXES]
        if not matches:
            raise SystemExit(f"Berkas audio untuk klip {row['clip_id']} tidak ditemukan di {clips_dir}.")
        row["path"] = matches[0]
    return rows


def cache_key(adapter: str, path: Path) -> str:
    return ScoreCache.key("asr", adapter, hashlib.sha256(path.read_bytes()).hexdigest())


def transcribe_all(adapter, rows: list[dict], sleep_seconds: float) -> list[dict]:
    """Satu baris hasil per klip. Klip yang gagal dilaporkan, bukan diam-diam dilewati."""
    import time

    cache = CACHE.load()
    results = []
    for row in rows:
        key = cache_key(adapter.name, row["path"])
        if key in cache:
            outcome = AsrResult(**cache[key])
        else:
            try:
                outcome = adapter.transcribe(row["path"], row["language"], row["keyterms"])
            except QuotaExhausted:
                print(f"\nJatah {adapter.name} habis. Hasil yang sudah terambil tersimpan; jalankan lagi nanti.")
                break
            if outcome.error:
                print(f"  ! {row['clip_id']}: {outcome.error} (tidak disimpan, akan diulang)")
                continue
            CACHE.append(key, outcome.__dict__)
            time.sleep(sleep_seconds)
        results.append({**row, "adapter": adapter.name, "hyp": outcome.text, "raw": outcome.raw_text, "seconds": outcome.seconds})
    return results


def summarize(results: list[dict]) -> dict:
    """Angka ringkas untuk satu kumpulan klip dari satu model."""
    spoken = [r for r in results if r["style"] != SILENT_STYLE]
    silent = [r for r in results if r["style"] == SILENT_STYLE]
    word_pairs = [wer.word_errors(r["reference_text"], r["hyp"]) for r in spoken]
    char_pairs = [wer.char_errors(r["reference_text"], r["hyp"]) for r in spoken]
    recalls = [x for r in spoken if (x := wer.term_recall(r["keyterms"], r["hyp"])) is not None]
    return {
        "clips": len(spoken),
        "wer": wer.corpus_rate(word_pairs) if word_pairs else None,
        "wer_ci": wer.bootstrap_ci(word_pairs) if len(word_pairs) >= MIN_GROUP_FOR_CI else None,
        "cer": wer.corpus_rate(char_pairs) if char_pairs else None,
        "term_recall": statistics.mean(recalls) if recalls else None,
        "latency_median": statistics.median(r["seconds"] for r in results) if results else None,
        "rtf": statistics.median(r["seconds"] / r["duration_s"] for r in results if r["duration_s"]) if any(r["duration_s"] for r in results) else None,
        "silent_clips": len(silent),
        # Halusinasi pada klip hening: ada teks sama sekali, sebelum dan sesudah filter produksi.
        "hallucination_raw": sum(bool(wer.words(r["raw"])) for r in silent) / len(silent) if silent else None,
        "hallucination_filtered": sum(bool(wer.words(r["hyp"])) for r in silent) / len(silent) if silent else None,
    }


def _fmt(value, spec="{:.3f}", dash="-") -> str:
    return dash if value is None else spec.format(value)


def render_row(label: str, s: dict) -> str:
    ci = f"{s['wer_ci'][0]:.3f}–{s['wer_ci'][1]:.3f}" if s["wer_ci"] else "klip < 5"
    return (
        f"| {label} | {s['clips']} | {_fmt(s['wer'])} | {ci} | {_fmt(s['cer'])} | {_fmt(s['term_recall'])} "
        f"| {_fmt(s['latency_median'], '{:.1f} dtk')} | {_fmt(s['rtf'], '{:.2f}')} "
        f"| {_fmt(s['hallucination_raw'], '{:.0%}')} → {_fmt(s['hallucination_filtered'], '{:.0%}')} |"
    )


HEADER = (
    "| | Klip | WER | 95% CI | CER | Recall istilah | Latensi median | RTF | Halusinasi hening (mentah → disaring) |\n"
    "|---|---|---|---|---|---|---|---|---|"
)


def build_report(all_results: dict[str, list[dict]]) -> str:
    lines = [
        "# Laporan ASR Cek Paham",
        "",
        "WER dan CER dihitung pada korpus (total galat / total kata), bukan rata-rata per klip. "
        "RTF = waktu proses / durasi audio (< 1 berarti lebih cepat dari waktu nyata). "
        "Halusinasi dihitung pada klip hening: berapa banyak yang menghasilkan teks.",
        "",
        "## Keseluruhan",
        "",
        HEADER,
    ]
    lines += [render_row(name, summarize(rows)) for name, rows in all_results.items()]
    for group in GROUPS:
        values = sorted({r[group] for rows in all_results.values() for r in rows})
        if len(values) < 2:
            continue
        lines += ["", f"## Per {group}", "", HEADER]
        for value in values:
            for name, rows in all_results.items():
                subset = [r for r in rows if r[group] == value]
                if subset:
                    lines.append(render_row(f"{name} / {value}", summarize(subset)))
    lines += [
        "",
        "## Keterbatasan",
        "",
        "- Jumlah klip dan penuturnya terbatas; interval kepercayaan lebar bila klip per kelompok sedikit.",
        "- Referensi diketik manusia; galat pada referensi ikut masuk ke WER.",
        "- Angka ini mengukur ASR pada rekaman tim, bukan pada mahasiswa sebenarnya (logat, perangkat, ruangan).",
        "- Angka dengan klip sintetis (TTS) hanya menguji jalur skrip, bukan kualitas pada suara manusia.",
    ]
    return "\n".join(lines) + "\n"


def write_clip_csv(all_results: dict[str, list[dict]], path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["adapter", "clip_id", "language", "device", "noise", "style", "wer_errors", "ref_words", "seconds", "hyp"])
        for name, rows in all_results.items():
            for r in rows:
                errors, length = wer.word_errors(r["reference_text"], r["hyp"]) if r["style"] != SILENT_STYLE else ("", "")
                out.writerow([name, r["clip_id"], r["language"], r["device"], r["noise"], r["style"], errors, length, f"{r['seconds']:.2f}", r["hyp"]])
