"""Tahap 3: cari bobot sinyal teks yang terukur, bukan karangan.

Bobot TEXT_WEIGHTS di academics/ai_score.py ditulis dari penalaran sebelum ada
satu pun pengukuran. Sekarang gold set 999 sampel ada, jadi bobotnya bisa
dicari, bukan ditebak.

Protokol yang menjaga kejujurannya:

1. Pencarian HANYA memakai split train. Split test tidak pernah dilihat selama
   pencarian, dan angka test itulah yang boleh dikutip.
2. Selain pencarian bebas, ada varian dengan bobot lantai 0,05 untuk ketiga
   sinyal yang diam di register abstrak (formulaic, impersonality,
   flat_certainty). Ketiganya "belum teruji", bukan "terbukti buruk" - gold set
   berisi abstrak akademik yang menurut konvensinya impersonal, sedangkan
   produk menilai esai mahasiswa. Menolkan bobotnya berdasarkan register yang
   salah berarti membuang sinyal yang mungkin justru hidup di register yang
   benar.
3. Ambang band diturunkan ulang untuk bobot terpilih, karena ambang 56 diukur
   untuk bobot lama dan tidak otomatis berlaku untuk bobot baru.

Jalankan dari folder ai_experiment:

    python -m src.tune_weights
"""
from __future__ import annotations

import argparse
import sys
from itertools import combinations
from pathlib import Path

from .config import GOLD_DIR
from .evaluate_baseline import bootstrap_backend, load_rows
from .metrics import roc_auc, threshold_at_max_fpr

SIGNAL_KEYS = [
    "uniformity",
    "formulaic_phrasing",
    "impersonality",
    "flat_certainty",
    "lexical_uniformity",
]

# Sinyal yang diam pada register abstrak; lihat catatan protokol di atas.
UNTESTED_KEYS = {"formulaic_phrasing", "impersonality", "flat_certainty"}

STEP = 0.05


def collect_signal_matrix(rows: list[dict]) -> tuple[list[list[float]], list[int]]:
    """Nilai kelima sinyal per sampel, memakai kode produksi asli."""
    from academics.ai_score import text_signal_scores
    from academics.text_features import extract_features

    matrix: list[list[float]] = []
    labels: list[int] = []
    for row in rows:
        by_key = {
            signal.key: signal.value
            for signal in text_signal_scores(extract_features(row["text"]))
        }
        matrix.append([by_key[key] for key in SIGNAL_KEYS])
        labels.append(row["binary_label"])
    return matrix, labels


def blend(matrix: list[list[float]], weights: tuple[float, ...]) -> list[float]:
    return [
        sum(value * weight for value, weight in zip(sample, weights))
        for sample in matrix
    ]


def production_scores(matrix: list[list[float]], weights: tuple[float, ...]) -> list[float]:
    """Skor bulat 0..100 persis seperti yang dihitung produksi."""
    return [
        float(int(round(max(0.0, min(1.0, raw)) * 100)))
        for raw in blend(matrix, weights)
    ]


def weight_grid(floors: dict[str, float]) -> list[tuple[float, ...]]:
    """Semua kombinasi bobot berjumlah 1,0 dengan langkah STEP.

    Dibangun lewat komposisi bilangan bulat supaya jumlahnya persis 1,0 tanpa
    galat pembulatan.
    """
    units = round(1.0 / STEP)
    floor_units = [round(floors.get(key, 0.0) / STEP) for key in SIGNAL_KEYS]
    free_units = units - sum(floor_units)
    if free_units < 0:
        raise ValueError("Lantai bobot melebihi 1,0")

    grids: list[tuple[float, ...]] = []
    # Komposisi free_units ke 5 slot lewat sekat (stars and bars).
    for dividers in combinations(range(free_units + 4), 4):
        previous = -1
        parts = []
        for divider in dividers:
            parts.append(divider - previous - 1)
            previous = divider
        parts.append(free_units + 3 - previous)
        grids.append(
            tuple(
                (part + floor) * STEP
                for part, floor in zip(parts, floor_units)
            )
        )
    return grids


def search(
    matrix: list[list[float]],
    labels: list[int],
    floors: dict[str, float],
) -> tuple[tuple[float, ...], float]:
    best_weights: tuple[float, ...] = ()
    best_auc = -1.0
    for weights in weight_grid(floors):
        auc = roc_auc(blend(matrix, weights), labels)
        if auc > best_auc:
            best_auc = auc
            best_weights = weights
    return best_weights, best_auc


def describe(name: str, weights: tuple[float, ...]) -> None:
    parts = ", ".join(
        f"{key}={weight:.2f}" for key, weight in zip(SIGNAL_KEYS, weights)
    )
    print(f"  {name}: {parts}")


def evaluate_on(
    label: str,
    matrix: list[list[float]],
    labels: list[int],
    weights: tuple[float, ...],
) -> float:
    auc = roc_auc(blend(matrix, weights), labels)
    print(f"    ROC-AUC {label}: {auc:.3f}")
    return auc


def main() -> int:
    parser = argparse.ArgumentParser(description="Cari bobot sinyal teks E1.")
    parser.add_argument("--gold", default=str(GOLD_DIR / "gold_set.csv"))
    args = parser.parse_args()

    bootstrap_backend()
    from academics.ai_score import TEXT_WEIGHTS

    all_rows = load_rows(Path(args.gold), None, "exclude")
    train_rows = [row for row in all_rows if row.get("split") == "train"]
    test_rows = [row for row in all_rows if row.get("split") == "test"]
    if not train_rows or not test_rows:
        raise SystemExit("Gold set belum punya kolom split train/test.")

    print(
        f"Sampel: {len(all_rows)} total, {len(train_rows)} train, "
        f"{len(test_rows)} test"
    )
    print("Menghitung sinyal produksi untuk semua sampel...")
    train_matrix, train_labels = collect_signal_matrix(train_rows)
    test_matrix, test_labels = collect_signal_matrix(test_rows)
    full_matrix = train_matrix + test_matrix
    full_labels = train_labels + test_labels

    print("\nAUC per sinyal sendirian (test):")
    for index, key in enumerate(SIGNAL_KEYS):
        solo = [sample[index] for sample in test_matrix]
        print(f"  {key:<22} {roc_auc(solo, test_labels):.3f}")

    current = tuple(TEXT_WEIGHTS[key] for key in SIGNAL_KEYS)
    print("\nBobot produksi sekarang:")
    describe("sekarang", current)
    evaluate_on("train", train_matrix, train_labels, current)
    current_test_auc = evaluate_on("test", test_matrix, test_labels, current)

    print("\nPencarian bebas (grid 0,05; hanya melihat train):")
    free_weights, free_train_auc = search(train_matrix, train_labels, {})
    describe("terbaik", free_weights)
    print(f"    ROC-AUC train: {free_train_auc:.3f}")
    free_test_auc = evaluate_on("test", test_matrix, test_labels, free_weights)

    floors = {key: 0.05 for key in UNTESTED_KEYS}
    print("\nPencarian dengan lantai 0,05 untuk sinyal yang belum teruji:")
    floor_weights, floor_train_auc = search(train_matrix, train_labels, floors)
    describe("terbaik", floor_weights)
    print(f"    ROC-AUC train: {floor_train_auc:.3f}")
    floor_test_auc = evaluate_on("test", test_matrix, test_labels, floor_weights)

    print("\nAmbang band untuk tiap kandidat (FPR < 5%, dihitung pada 999 sampel,")
    print("memakai skor bulat 0..100 persis seperti produksi):")
    for name, weights in (
        ("sekarang", current),
        ("bebas", free_weights),
        ("lantai 0,05", floor_weights),
    ):
        scores = production_scores(full_matrix, weights)
        threshold, report = threshold_at_max_fpr(scores, full_labels, max_fpr=0.05)
        print(
            f"  {name:<12} ambang >= {threshold:>3}  "
            f"recall {report.recall:.3f}  FPR {report.false_positive_rate:.3f}  "
            f"presisi {report.precision:.3f}"
        )

    print(
        "\nCatatan register: seluruh angka di atas diukur pada abstrak akademik."
        "\nSinyal yang diam di register ini belum tentu diam pada esai mahasiswa,"
        "\nkarena itu varian lantai 0,05 yang layak dipertimbangkan untuk"
        "\nproduksi, bukan varian bebas yang menolkan sinyal tak teruji."
    )

    improvement = floor_test_auc - current_test_auc
    print(f"\nSelisih test AUC (lantai vs sekarang): {improvement:+.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
