"""Metrik evaluasi, ditulis tanpa dependensi berat.

Sengaja pure Python supaya folder ini bisa dijalankan siapa pun tanpa memasang
scikit-learn lebih dulu. Kalau nanti masuk tahap kalibrasi regresi logistik,
barulah scikit-learn ditambahkan.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BinaryReport:
    threshold: int
    true_positive: int
    false_positive: int
    true_negative: int
    false_negative: int

    @property
    def precision(self) -> float:
        denom = self.true_positive + self.false_positive
        return self.true_positive / denom if denom else 0.0

    @property
    def recall(self) -> float:
        denom = self.true_positive + self.false_negative
        return self.true_positive / denom if denom else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0

    @property
    def false_positive_rate(self) -> float:
        """Porsi tulisan manusia yang dituduh AI.

        Ini metrik paling penting secara etis di seluruh berkas ini. Recall
        tinggi tidak ada artinya kalau harganya adalah menuduh mahasiswa jujur.
        """
        denom = self.false_positive + self.true_negative
        return self.false_positive / denom if denom else 0.0

    @property
    def accuracy(self) -> float:
        total = (
            self.true_positive
            + self.false_positive
            + self.true_negative
            + self.false_negative
        )
        correct = self.true_positive + self.true_negative
        return correct / total if total else 0.0


def confusion_at(scores: list[float], labels: list[int], threshold: float) -> BinaryReport:
    """labels: 1 berarti AI, 0 berarti manusia."""
    tp = fp = tn = fn = 0
    for score, label in zip(scores, labels):
        predicted_ai = score >= threshold
        if label == 1 and predicted_ai:
            tp += 1
        elif label == 1:
            fn += 1
        elif predicted_ai:
            fp += 1
        else:
            tn += 1
    return BinaryReport(int(threshold), tp, fp, tn, fn)


def roc_auc(scores: list[float], labels: list[int]) -> float:
    """AUC lewat statistik peringkat Mann-Whitney, aman terhadap nilai seri.

    Nilai 0,5 berarti tidak lebih baik daripada menebak. Nilai di bawah 0,5
    berarti arahnya terbalik.
    """
    positives = [s for s, y in zip(scores, labels) if y == 1]
    negatives = [s for s, y in zip(scores, labels) if y == 0]
    if not positives or not negatives:
        return float("nan")

    paired = sorted(zip(scores, labels))
    ranks: list[float] = [0.0] * len(paired)
    index = 0
    while index < len(paired):
        stop = index
        while stop + 1 < len(paired) and paired[stop + 1][0] == paired[index][0]:
            stop += 1
        average_rank = (index + stop) / 2.0 + 1.0
        for position in range(index, stop + 1):
            ranks[position] = average_rank
        index = stop + 1

    positive_rank_sum = sum(
        rank for rank, (_, label) in zip(ranks, paired) if label == 1
    )
    n_pos, n_neg = len(positives), len(negatives)
    return (positive_rank_sum - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)


def threshold_at_max_fpr(
    scores: list[float], labels: list[int], max_fpr: float = 0.05
) -> tuple[int, BinaryReport]:
    """Ambang terendah yang masih menjaga tuduhan salah di bawah batas.

    Inilah cara memilih ambang yang bisa dipertanggungjawabkan. Memilih 70
    karena angkanya bulat tidak bisa dijawab saat juri bertanya berapa banyak
    mahasiswa jujur yang akan tertuduh.
    """
    best = confusion_at(scores, labels, 101)
    best_threshold = 101
    for threshold in range(100, -1, -1):
        report = confusion_at(scores, labels, threshold)
        if report.false_positive_rate > max_fpr:
            break
        best, best_threshold = report, threshold
    return best_threshold, best


def pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return float("nan")
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    var_x = sum((x - mean_x) ** 2 for x in xs)
    var_y = sum((y - mean_y) ** 2 for y in ys)
    if var_x == 0 or var_y == 0:
        return 0.0
    return cov / ((var_x**0.5) * (var_y**0.5))
