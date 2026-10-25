"""Ukur kesepakatan antar penilai, lalu ukur E2 terhadap label mereka.

Urutan itu disengaja dan tidak boleh dibalik. Angka akurasi mesin tidak bisa
ditafsirkan sebelum diketahui seberapa jauh manusia sendiri sepakat. Kalau dua
penilai hanya sepakat 65%, mesin yang mencapai 60% sudah nyaris menyentuh langit
langit tugas ini, dan melaporkannya sebagai kegagalan justru keliru.

Dipakai oleh notebooks/05_validasi_bloom.ipynb.
"""
from __future__ import annotations

import csv
from pathlib import Path

from .agreement import (
    BLOOM_LABELS,
    UNRATEABLE,
    compare_raters,
    render_confusion,
    score_predictions,
)
from .evaluate_baseline import bootstrap_backend

VALID = set(BLOOM_LABELS) | {UNRATEABLE}


def read_labels(path: Path) -> dict[str, str]:
    """Baca CSV keluaran tools/label.html: kolom id dan label."""
    if not path.exists():
        raise SystemExit(f"Berkas tidak ditemukan: {path}")

    labels: dict[str, str] = {}
    skipped = 0
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            item_id = (row.get("id") or "").strip()
            label = (row.get("label") or "").strip().upper()
            if not item_id:
                continue
            if label not in VALID:
                skipped += 1
                continue
            labels[item_id] = label
    if skipped:
        print(f"  {path.name}: {skipped} baris dilewati karena labelnya tidak sah")
    return labels


def read_answers(path: Path) -> dict[str, str]:
    if not path.exists():
        raise SystemExit(f"Berkas tidak ditemukan: {path}")
    answers: dict[str, str] = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            item_id = (row.get("id") or "").strip()
            if item_id:
                answers[item_id] = row.get("text") or ""
    return answers


def predict_with_e2(answers: dict[str, str]) -> dict[str, str]:
    """Jalankan estimator Bloom produksi, bukan salinannya.

    Mengimpor langsung dari backend/apps/analysis supaya laporan tidak pernah basi
    diam diam ketika kode produksi berubah.
    """
    bootstrap_backend()
    from apps.analysis.engines.bloom import estimate_bloom_level
    from apps.analysis.engines.text_features import extract_features

    return {
        item_id: str(estimate_bloom_level(extract_features(text)).level)
        for item_id, text in answers.items()
    }


def print_agreement(rater_a: dict[str, str], rater_b: dict[str, str], names) -> None:
    report = compare_raters(rater_a, rater_b)
    print(f"\n=== Kesepakatan antar penilai: {names[0]} vs {names[1]} ===")
    print(f"Item dinilai keduanya : {report.n}")
    if report.excluded:
        print(f"Dikecualikan (X)      : {report.excluded}")

    if report.n == 0:
        print("\nTidak ada item yang dinilai keduanya. Periksa apakah kolom id cocok.")
        return

    print(f"Sepakat persis        : {report.observed:.1%}")
    print(f"Cohen's kappa         : {report.kappa:.3f} ({report.interpretation})")
    print(f"Kappa berbobot        : {report.weighted_kappa:.3f}")

    if report.kappa < 0.4:
        print(
            "\n  PERINGATAN: kappa di bawah 0,4. JANGAN lanjut melabeli.\n"
            "  Baca bersama item yang berbeda penilaiannya, perbaiki rubriknya,\n"
            "  lalu ulangi kalibrasi dengan 20 item baru. Melabeli 300 item pada\n"
            "  kappa serendah ini berarti membuang seluruh pekerjaan itu."
        )
    elif report.kappa < 0.6:
        print(
            "\n  Kappa sedang. Boleh lanjut, tetapi bahas dulu pola\n"
            "  ketidaksepakatannya di bawah ini."
        )

    print("\nMatriks konfusi (baris = " + names[0] + ", kolom = " + names[1] + ")")
    print(render_confusion(report.confusion, ""))

    if report.disagreements:
        print(f"\nKetidaksepakatan terbesar lebih dulu ({len(report.disagreements)} total):")
        for item_id, first, second in report.disagreements[:15]:
            gap = abs(int(first) - int(second))
            print(f"  {item_id:<24} C{first} vs C{second}   selisih {gap}")
        if len(report.disagreements) > 15:
            print(f"  ... dan {len(report.disagreements) - 15} lainnya")


def print_system(gold: dict[str, str], predicted: dict[str, str], ceiling: float) -> None:
    report = score_predictions(gold, predicted)
    print("\n=== E2 terhadap label acuan ===")
    print(f"Item dibandingkan     : {report.n}")

    if report.n == 0:
        print("Tidak ada item yang bisa dibandingkan.")
        return

    print(f"Akurasi tepat         : {report.accuracy:.1%}")
    print(f"Akurasi meleset <= 1  : {report.adjacent_accuracy:.1%}")
    print(f"F1 makro              : {report.macro_f1:.3f}")

    print("\nPer level (hanya yang muncul di acuan):")
    print(f"  {'level':<8}{'presisi':>9}{'recall':>9}{'F1':>8}{'jumlah':>8}")
    for label, stat in report.per_label.items():
        if not stat["support"]:
            continue
        print(
            f"  C{label:<7}{stat['precision']:>9.3f}{stat['recall']:>9.3f}"
            f"{stat['f1']:>8.3f}{int(stat['support']):>8}"
        )

    print("\nMatriks konfusi (baris = acuan, kolom = sistem)")
    print(render_confusion(report.confusion, ""))

    if ceiling == ceiling:  # bukan NaN
        print(f"\nLangit langit manusia : {ceiling:.1%} (kesepakatan antar penilai)")
        gap = ceiling - report.accuracy
        if gap <= 0.05:
            print(
                "  Sistem praktis menyentuh batas atas tugas ini. Sebagian besar\n"
                "  kesalahannya berada pada kasus yang manusia sendiri\n"
                "  memperdebatkannya, jadi menaikkannya lagi belum tentu berarti."
            )
        else:
            print(
                f"  Masih ada jarak {gap:.1%} menuju batas atas. Ini kesenjangan\n"
                "  nyata yang layak diperbaiki."
            )
