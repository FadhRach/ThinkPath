"""Tahap 3: cari bobot sinyal teks yang terukur, bukan karangan.

Bobot TEXT_WEIGHTS di apps/analysis/engines/ai_score.py ditulis dari penalaran sebelum ada
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

Dipakai oleh notebooks/03_tuning_bobot.ipynb.
"""
from __future__ import annotations

from itertools import combinations

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
    from apps.analysis.engines.ai_score import text_signal_scores
    from apps.analysis.engines.text_features import extract_features

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


def split_rows(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    train = [row for row in rows if row.get("split") == "train"]
    test = [row for row in rows if row.get("split") == "test"]
    if not train or not test:
        raise ValueError("Gold set belum punya kolom split train/test.")
    return train, test


def run_tuning(rows: list[dict]) -> dict:
    """Seluruh protokol tuning, hasilnya berupa data (bukan cetakan).

    Kunci hasil: `solo_auc` (AUC tiap sinyal sendirian di test), `candidates` (daftar kandidat
    bobot: sekarang, bebas, lantai 0,05; masing-masing dengan bobot, AUC train, AUC test, dan
    ambang band pada FPR < 5%), `n_train`, `n_test`.
    """
    from apps.analysis.engines.ai_score import TEXT_WEIGHTS

    train_rows, test_rows = split_rows(rows)
    train_matrix, train_labels = collect_signal_matrix(train_rows)
    test_matrix, test_labels = collect_signal_matrix(test_rows)
    full_matrix = train_matrix + test_matrix
    full_labels = train_labels + test_labels

    solo_auc = {
        key: roc_auc([sample[index] for sample in test_matrix], test_labels)
        for index, key in enumerate(SIGNAL_KEYS)
    }

    current = tuple(TEXT_WEIGHTS[key] for key in SIGNAL_KEYS)
    free_weights, _ = search(train_matrix, train_labels, {})
    floors = {key: 0.05 for key in UNTESTED_KEYS}
    floor_weights, _ = search(train_matrix, train_labels, floors)

    candidates = []
    for name, weights in (
        ("sekarang", current),
        ("bebas", free_weights),
        ("lantai 0,05", floor_weights),
    ):
        scores = production_scores(full_matrix, weights)
        threshold, report = threshold_at_max_fpr(scores, full_labels, max_fpr=0.05)
        candidates.append(
            {
                "kandidat": name,
                "bobot": dict(zip(SIGNAL_KEYS, weights)),
                "auc_train": roc_auc(blend(train_matrix, weights), train_labels),
                "auc_test": roc_auc(blend(test_matrix, weights), test_labels),
                "ambang_fpr5": threshold,
                "recall": report.recall,
                "fpr": report.false_positive_rate,
                "presisi": report.precision,
            }
        )
    return {
        "n_train": len(train_rows),
        "n_test": len(test_rows),
        "solo_auc": solo_auc,
        "candidates": candidates,
    }
