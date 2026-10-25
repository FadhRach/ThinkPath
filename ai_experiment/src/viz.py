"""Grafik untuk notebook. Hanya menggambar; semua angkanya dihitung di metrics.py dan evaluation.py."""
from __future__ import annotations

import matplotlib.pyplot as plt

from .metrics import confusion_at, roc_auc, roc_points

HUMAN_COLOR = "#0E7C86"
AI_COLOR = "#D9534F"
MUTED = "#9AB8BB"


def plot_score_distribution(scores, labels, *, mid: int, high: int, title: str = "Sebaran skor"):
    """Histogram skor per kelas dengan garis ambang produksi."""
    fig, ax = plt.subplots(figsize=(7, 3.2))
    bins = range(0, 105, 5)
    ax.hist([s for s, y in zip(scores, labels) if y == 0], bins=bins, alpha=0.65, color=HUMAN_COLOR, label="manusia")
    ax.hist([s for s, y in zip(scores, labels) if y == 1], bins=bins, alpha=0.65, color=AI_COLOR, label="AI")
    for value, name in ((mid, "mid"), (high, "high")):
        ax.axvline(value, color="#444", linestyle="--", linewidth=1)
        ax.text(value + 0.8, ax.get_ylim()[1] * 0.92, f"{name} {value}", fontsize=8)
    ax.set_xlabel("skor indikasi AI (0-100)")
    ax.set_ylabel("jumlah teks")
    ax.set_title(title)
    ax.legend()
    fig.tight_layout()
    return fig


def plot_roc(curves: dict[str, tuple[list[float], list[int]]], title: str = "Kurva ROC"):
    """Satu atau beberapa mesin pada subset yang sama: {nama: (skor, label)}."""
    fig, ax = plt.subplots(figsize=(4.6, 4.2))
    ax.plot([0, 1], [0, 1], color=MUTED, linestyle=":", label="menebak (0,50)")
    for name, (scores, labels) in curves.items():
        points = roc_points(scores, labels)
        if points:
            ax.plot(*zip(*points), label=f"{name} (AUC {roc_auc(scores, labels):.3f})")
    ax.set_xlabel("FPR: manusia yang tertuduh")
    ax.set_ylabel("recall: AI yang tertangkap")
    ax.set_title(title)
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    return fig


def plot_threshold_sweep(scores, labels, *, max_fpr: float = 0.05, marks: tuple[int, ...] = ()):
    """FPR dan recall di setiap ambang; garis batas FPR menunjukkan ambang yang bisa dipertanggungjawabkan."""
    thresholds = list(range(0, 101))
    reports = [confusion_at(scores, labels, t) for t in thresholds]
    fig, ax = plt.subplots(figsize=(7, 3.2))
    ax.plot(thresholds, [r.false_positive_rate for r in reports], color=AI_COLOR, label="FPR (manusia tertuduh)")
    ax.plot(thresholds, [r.recall for r in reports], color=HUMAN_COLOR, label="recall (AI tertangkap)")
    ax.axhline(max_fpr, color="#444", linestyle="--", linewidth=1)
    ax.text(1, max_fpr + 0.015, f"batas FPR {max_fpr:.0%}", fontsize=8)
    for value in marks:
        ax.axvline(value, color=MUTED, linestyle=":")
    ax.set_xlabel("ambang skor")
    ax.set_ylim(0, 1.02)
    ax.legend(fontsize=8)
    fig.tight_layout()
    return fig


def plot_signal_correlations(rows: list[dict]):
    """Batang korelasi tiap sinyal terhadap label; hijau = searah, merah = terbalik, abu = mati."""
    rows = sorted(rows, key=lambda row: row["korelasi"])
    colors = [
        MUTED if abs(r["korelasi"]) < 0.05 else (AI_COLOR if r["korelasi"] < 0 else HUMAN_COLOR)
        for r in rows
    ]
    fig, ax = plt.subplots(figsize=(6.5, 0.45 * len(rows) + 1))
    ax.barh([r["sinyal"] for r in rows], [r["korelasi"] for r in rows], color=colors)
    ax.axvline(0, color="#444", linewidth=0.8)
    ax.set_xlabel("korelasi terhadap label AI")
    fig.tight_layout()
    return fig


def plot_confusion(confusion: dict[tuple[str, str], int], labels: tuple[str, ...], title: str, row_title: str, col_title: str):
    """Matriks konfusi sebagai peta panas."""
    grid = [[confusion.get((row, col), 0) for col in labels] for row in labels]
    fig, ax = plt.subplots(figsize=(4.2, 3.8))
    ax.imshow(grid, cmap="GnBu")
    ax.set_xticks(range(len(labels)), labels)
    ax.set_yticks(range(len(labels)), labels)
    for i, row in enumerate(grid):
        for j, value in enumerate(row):
            ax.text(j, i, value, ha="center", va="center", fontsize=9)
    ax.set_xlabel(col_title)
    ax.set_ylabel(row_title)
    ax.set_title(title)
    fig.tight_layout()
    return fig
