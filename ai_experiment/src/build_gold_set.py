"""CLI pembangun gold set manusia vs AI berbahasa Indonesia.

Jalankan dari folder ai_experiment:

    python -m src.build_gold_set --target 500
    python -m src.build_gold_set --target 500 --include-mixed

Aman dihentikan di tengah jalan. Hasil sementara disimpan sebagai JSONL di
data/cache, jadi menjalankan ulang akan melanjutkan, bukan mengulang dari nol.
Ini penting karena bagian generate memakan ratusan panggilan API.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import sys
from pathlib import Path

from .config import (
    AI_CACHE,
    DEFAULT_MODELS,
    GOLD_DIR,
    GROQ_API_KEY,
    HUMAN_CACHE,
    HUMAN_CUTOFF_DATE,
    ensure_dirs,
)
from .generate import (
    PROMPT_VARIANTS,
    GenerationError,
    available_models,
    generate_ai_counterpart,
    generate_mixed_counterpart,
)
from .openalex import fetch_human_abstracts

TEST_SHARE = 0.2


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def append_jsonl(path: Path, row: dict) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def row_id(row: dict) -> str:
    seed = f"{row['openalex_id']}|{row['label']}|{row.get('generator', '')}"
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16]


def collect_human(target: int) -> list[dict]:
    existing = load_jsonl(HUMAN_CACHE)
    if len(existing) >= target:
        print(f"[manusia] cache sudah punya {len(existing)} baris, lewati unduhan")
        return existing[:target]

    needed = target - len(existing)
    print(f"[manusia] ambil {needed} abstrak terbit sebelum {HUMAN_CUTOFF_DATE}")
    seen = {row["openalex_id"] for row in existing}

    for row in fetch_human_abstracts(target=needed + len(seen)):
        if row["openalex_id"] in seen:
            continue
        seen.add(row["openalex_id"])
        append_jsonl(HUMAN_CACHE, row)
        existing.append(row)
        if len(existing) % 25 == 0:
            print(f"[manusia] {len(existing)}/{target}")
        if len(existing) >= target:
            break

    print(f"[manusia] selesai, {len(existing)} baris")
    return existing[:target]


def validate_models(models: list[str]) -> list[str]:
    """Buang model yang sudah tidak dilayani, dan katakan mana yang hilang.

    Penyedia menghentikan model tanpa pemberitahuan. Tanpa pemeriksaan ini,
    satu nama basi membuat sebagian sampel gagal diam diam dan sebaran generator
    jadi timpang tanpa terlihat di laporan akhir.
    """
    catalogue = available_models()
    if not catalogue:
        print("[model] tidak bisa memeriksa katalog, lanjut dengan daftar apa adanya")
        return models

    usable = [name for name in models if name in catalogue]
    missing = [name for name in models if name not in catalogue]
    if missing:
        print(f"[model] tidak tersedia dan dilewati: {', '.join(missing)}")
    if not usable:
        print(
            "[model] tidak ada model yang bisa dipakai.\n"
            f"        Yang tersedia di akun ini: {', '.join(sorted(catalogue))}"
        )
        return []
    print(f"[model] dipakai: {', '.join(usable)}")
    return usable


def collect_ai(
    human_rows: list[dict], models: list[str], include_mixed: bool, seed: int
) -> list[dict]:
    existing = load_jsonl(AI_CACHE)
    done = {(row["openalex_id"], row["label"]) for row in existing}
    rng = random.Random(seed)
    variants = list(PROMPT_VARIANTS)

    todo = [row for row in human_rows if (row["openalex_id"], "ai") not in done]
    if include_mixed:
        todo += [
            row for row in human_rows if (row["openalex_id"], "mixed") not in done
        ]

    if not todo:
        print(f"[ai] cache sudah lengkap, {len(existing)} baris")
        return existing

    print(f"[ai] perlu membuat {len(todo)} teks lewat {len(models)} model")
    failures = 0

    for index, human in enumerate(human_rows, start=1):
        for label in ("ai", "mixed") if include_mixed else ("ai",):
            if (human["openalex_id"], label) in done:
                continue
            model = models[index % len(models)]
            try:
                if label == "ai":
                    variant = variants[index % len(variants)]
                    row = generate_ai_counterpart(human, model, variant, rng)
                else:
                    row = generate_mixed_counterpart(human, model)
            except GenerationError as exc:
                failures += 1
                print(f"[ai] lewati {human['openalex_id']} ({label}): {exc}")
                if failures >= 10:
                    print("[ai] terlalu banyak kegagalan berturut, berhenti")
                    return existing
                continue
            failures = 0
            append_jsonl(AI_CACHE, row)
            existing.append(row)
            done.add((human["openalex_id"], label))

        if index % 20 == 0:
            print(f"[ai] {index}/{len(human_rows)} judul diproses")

    print(f"[ai] selesai, {len(existing)} baris")
    return existing


def _split_by_work(rows: list[dict]) -> dict[str, str]:
    """Pisah per karya. Ini pemisahan bawaan.

    Kebocoran yang paling merusak adalah abstrak manusia dan padanan AI dari
    judul yang sama jatuh di sisi berbeda. Model lalu melihat topik test saat
    latih, dan akurasinya terlihat lebih tinggi daripada kenyataannya. Karena
    kuncinya openalex_id, seluruh varian dari satu judul selalu satu sisi.

    Hash dipakai supaya pembagiannya deterministik: menjalankan ulang skrip
    menghasilkan split yang sama persis.
    """
    split_of: dict[str, str] = {}
    for row in rows:
        key = row["openalex_id"]
        if key in split_of:
            continue
        bucket = int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:8], 16) % 100
        split_of[key] = "test" if bucket < TEST_SHARE * 100 else "train"
    return split_of


def _split_by_field(rows: list[dict]) -> dict[str, str]:
    """Pisah per bidang ilmu. Uji yang lebih keras.

    Test set berisi bidang yang sama sekali tidak dilihat saat latih, sehingga
    mengukur generalisasi lintas domain. Hanya bermanfaat kalau bidangnya cukup
    beragam. Dengan dua atau tiga bidang saja, hasilnya sangat berfluktuasi.
    """
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["field"]] = counts.get(row["field"], 0) + 1

    ordered = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    total = sum(counts.values())
    test_target = total * TEST_SHARE

    split_of: dict[str, str] = {}
    test_filled = 0
    for field, count in ordered:
        if test_filled < test_target and count < total * 0.5:
            split_of[field] = "test"
            test_filled += count
        else:
            split_of[field] = "train"
    return split_of


def assign_splits(rows: list[dict], strategy: str) -> tuple[dict[str, str], str]:
    """Kembalikan peta split beserta nama kolom yang jadi kuncinya."""
    if strategy == "field":
        return _split_by_field(rows), "field"
    return _split_by_work(rows), "openalex_id"


def write_csv(rows: list[dict], out_path: Path, split_by: str) -> None:
    split_of, split_key = assign_splits(rows, split_by)
    fields = [
        "id",
        "label",
        "text",
        "title",
        "year",
        "field",
        "word_count",
        "generator",
        "prompt_variant",
        "split",
    ]
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "id": row_id(row),
                    "label": row["label"],
                    "text": row["text"],
                    "title": row["title"],
                    "year": row["year"],
                    "field": row["field"],
                    "word_count": row["word_count"],
                    "generator": row.get("generator", ""),
                    "prompt_variant": row.get("prompt_variant", ""),
                    "split": split_of.get(row[split_key], "train"),
                }
            )


def report(rows: list[dict]) -> None:
    print("\n=== Ringkasan gold set ===")
    by_label: dict[str, list[int]] = {}
    for row in rows:
        by_label.setdefault(row["label"], []).append(row["word_count"])

    for label, lengths in sorted(by_label.items()):
        mean = sum(lengths) / len(lengths)
        print(f"  {label:<7} {len(lengths):>5} baris, rata rata {mean:.0f} kata")

    human = by_label.get("human")
    ai = by_label.get("ai")
    if human and ai:
        gap = abs(sum(human) / len(human) - sum(ai) / len(ai))
        print(f"\n  Selisih panjang rata rata manusia vs AI: {gap:.0f} kata")
        if gap > 30:
            print(
                "  PERINGATAN: selisih ini besar. Panjang teks bisa menjadi\n"
                "  petunjuk gratis bagi detektor, sehingga hasil evaluasi\n"
                "  terlihat lebih baik daripada kenyataannya. Pertimbangkan\n"
                "  memangkas atau menyeimbangkan panjang sebelum melatih."
            )

    generators: dict[str, int] = {}
    for row in rows:
        if row.get("generator"):
            generators[row["generator"]] = generators.get(row["generator"], 0) + 1
    if generators:
        print("\n  Sebaran generator:")
        for name, count in sorted(generators.items()):
            print(f"    {name:<28} {count}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bangun gold set manusia vs AI berbahasa Indonesia."
    )
    parser.add_argument("--target", type=int, default=500, help="jumlah abstrak manusia")
    parser.add_argument(
        "--models",
        default=",".join(DEFAULT_MODELS),
        help="daftar model Groq, dipisah koma",
    )
    parser.add_argument(
        "--include-mixed",
        action="store_true",
        help="tambahkan kelas campuran (teks manusia dipoles AI)",
    )
    parser.add_argument(
        "--human-only",
        action="store_true",
        help="hanya unduh sisi manusia, lewati pemanggilan LLM",
    )
    parser.add_argument(
        "--split-by",
        choices=("work", "field"),
        default="work",
        help=(
            "work menjaga pasangan manusia dan AI dari satu judul tetap satu "
            "sisi. field menguji generalisasi lintas bidang ilmu, lebih keras"
        ),
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default=str(GOLD_DIR / "gold_set.csv"))
    args = parser.parse_args()

    if not args.human_only and not GROQ_API_KEY:
        print(
            "GROQ_API_KEY belum di-set, sedangkan tahap generate membutuhkannya.\n"
            "Isi di ai_experiment/.env, atau jalankan dengan --human-only untuk\n"
            "mengunduh sisi manusia lebih dulu."
        )
        return 1

    ensure_dirs()
    human_rows = collect_human(args.target)
    if not human_rows:
        print("Tidak ada abstrak manusia yang berhasil diambil.")
        return 1

    rows = list(human_rows)
    if not args.human_only:
        models = [name.strip() for name in args.models.split(",") if name.strip()]
        models = validate_models(models)
        if not models:
            return 1
        rows += collect_ai(human_rows, models, args.include_mixed, args.seed)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_csv(rows, out_path, args.split_by)
    report(rows)
    print(f"\nTersimpan di {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
