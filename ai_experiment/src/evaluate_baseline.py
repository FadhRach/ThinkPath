"""Tahap 1 dan 2: ukur heuristik yang sudah dipakai produksi, lalu diagnosa.

Menjalankan scorer asli dari backend/apps/analysis terhadap gold_set.csv, bukan
salinannya. Kalau kode produksi berubah, angka di sini ikut berubah, sehingga
laporan tidak pernah basi diam diam.

Yang dijawab berkas ini:

1. Seberapa baik skor kita memisahkan manusia dan AI, lewat ROC-AUC.
2. Berapa banyak mahasiswa jujur yang tertuduh pada ambang yang dipakai
   sekarang, lewat false positive rate.
3. Ambang berapa yang menjaga tuduhan salah di bawah 5 persen.
4. Sinyal mana yang mati, dan sinyal mana yang arahnya terbalik.

Nomor 4 yang paling berharga. Sinyal dengan korelasi mendekati nol tidak
membedakan apa pun tetapi tetap menyumbang bobot ke setiap orang, sehingga hanya
menaikkan skor semua submission secara merata.

Dipakai oleh notebooks/02_baseline_heuristik.ipynb.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

from .config import BASE_DIR
from .evaluation import CURRENT_HIGH_THRESHOLD, CURRENT_MID_THRESHOLD
from .metrics import confusion_at, pearson, roc_auc, threshold_at_max_fpr


def bootstrap_backend() -> None:
    """Siapkan Django seminimal mungkin supaya apps.analysis bisa diimpor.

    Mesin skor hanya butuh enum di apps.analysis.choices, tetapi sebagian
    modul (detector_cache, pipeline) memuat model Django, yang menolak dimuat
    tanpa app registry aktif.

    Sengaja TIDAK memakai config.settings. Settings produksi menarik
    psycopg dan DRF, padahal evaluasi ini tidak menyentuh
    basis data sama sekali. Konfigurasi di bawah cukup untuk memuat definisi
    model, dan tidak pernah membuka koneksi.
    """
    backend_dir = BASE_DIR.parent / "backend"
    if not backend_dir.exists():
        raise SystemExit(f"Folder backend tidak ditemukan di {backend_dir}")
    sys.path.insert(0, str(backend_dir))

    import django
    from django.conf import settings

    if not settings.configured:
        settings.configure(
            INSTALLED_APPS=[
                "apps.accounts",
                "apps.academics",
                "apps.analysis",
            ],
            DATABASES={
                "default": {
                    "ENGINE": "django.db.backends.sqlite3",
                    "NAME": ":memory:",
                }
            },
            USE_TZ=True,
            DEFAULT_AUTO_FIELD="django.db.models.BigAutoField",
        )
    django.setup()


def load_rows(path: Path, split: str | None, mixed_as: str) -> list[dict]:
    if not path.exists():
        raise SystemExit(
            f"{path} belum ada. Bangun dulu lewat notebooks/01_gold_set.ipynb."
        )

    rows: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if split and row.get("split") != split:
                continue
            label = row["label"]
            if label == "mixed":
                if mixed_as == "exclude":
                    continue
                label = mixed_as
            rows.append({**row, "binary_label": 1 if label == "ai" else 0})
    return rows


def score_rows(rows: list[dict]) -> tuple[list[float], list[int], dict[str, list[float]]]:
    """Jalankan scorer produksi. Sinyal proses tidak ikut karena gold set hanya
    berisi teks, tanpa telemetri pengerjaan."""
    from apps.analysis.engines.ai_score import score_ai_probability
    from apps.analysis.engines.text_features import extract_features

    scores: list[float] = []
    labels: list[int] = []
    per_signal: dict[str, list[float]] = {}

    for row in rows:
        result = score_ai_probability(extract_features(row["text"]))
        scores.append(float(result.score))
        labels.append(row["binary_label"])
        for signal in result.breakdown:
            per_signal.setdefault(signal.key, []).append(signal.value)

    return scores, labels, per_signal


def print_overall(scores: list[float], labels: list[int]) -> None:
    n_ai = sum(labels)
    n_human = len(labels) - n_ai
    print(f"\nSampel: {len(labels)} ({n_human} manusia, {n_ai} AI)")

    if n_ai == 0 or n_human == 0:
        print(
            "\nHanya ada satu kelas. Metrik pemisahan tidak bisa dihitung.\n"
            "Bangun sisi AI lebih dulu dengan menjalankan build_gold_set tanpa\n"
            "--human-only."
        )
        return

    auc = roc_auc(scores, labels)
    print(f"ROC-AUC: {auc:.3f}")
    if auc < 0.6:
        print("  Nyaris tidak lebih baik daripada menebak.")
    if auc < 0.5:
        print("  Di bawah 0,5 berarti arah skornya terbalik.")

    print("\nPada ambang yang dipakai produksi sekarang:")
    for name, threshold in (
        ("mid", CURRENT_MID_THRESHOLD),
        ("high", CURRENT_HIGH_THRESHOLD),
    ):
        report = confusion_at(scores, labels, threshold)
        print(
            f"  {name:<5} (skor >= {threshold:>3})  "
            f"F1 {report.f1:.3f}  presisi {report.precision:.3f}  "
            f"recall {report.recall:.3f}  FPR {report.false_positive_rate:.3f}"
        )

    threshold, report = threshold_at_max_fpr(scores, labels, max_fpr=0.05)
    print(f"\nAmbang yang menjaga FPR di bawah 5 persen: skor >= {threshold}")
    print(
        f"  Pada ambang itu: F1 {report.f1:.3f}, recall {report.recall:.3f}, "
        f"FPR {report.false_positive_rate:.3f}"
    )
    print(
        f"  Artinya {report.false_positive} dari "
        f"{report.false_positive + report.true_negative} tulisan manusia "
        "tetap tertuduh."
    )


def signal_diagnostics(per_signal: dict[str, list[float]], labels: list[int]) -> list[dict]:
    """Korelasi tiap sinyal terhadap label, terkuat lebih dulu, dengan catatan."""
    if len(set(labels)) < 2:
        return []

    rows = []
    for key, values in per_signal.items():
        correlation = pearson(values, [float(y) for y in labels])
        human_values = [v for v, y in zip(values, labels) if y == 0]
        ai_values = [v for v, y in zip(values, labels) if y == 1]
        mean_human = sum(human_values) / len(human_values) if human_values else 0.0
        mean_ai = sum(ai_values) / len(ai_values) if ai_values else 0.0
        note = ""
        if abs(correlation) < 0.05:
            note = "MATI, tidak membedakan apa pun"
        elif correlation < -0.1:
            note = "TERBALIK, arahnya melawan label"
        elif abs(mean_human - mean_ai) < 0.02:
            note = "nyaris identik antar kelas"
        rows.append(
            {
                "sinyal": key,
                "korelasi": correlation,
                "rata2_manusia": mean_human,
                "rata2_ai": mean_ai,
                "catatan": note,
            }
        )
    return sorted(rows, key=lambda row: abs(row["korelasi"]), reverse=True)


def print_signal_diagnostics(
    per_signal: dict[str, list[float]], labels: list[int]
) -> None:
    rows = signal_diagnostics(per_signal, labels)
    if not rows:
        return

    print("\nDiagnostik per sinyal")
    print(f"  {'sinyal':<22} {'korelasi':>9} {'manusia':>9} {'AI':>9}  catatan")
    for row in rows:
        print(
            f"  {row['sinyal']:<22} {row['korelasi']:>9.3f} {row['rata2_manusia']:>9.3f} "
            f"{row['rata2_ai']:>9.3f}  {row['catatan']}"
        )

    print(
        "\n  Korelasi positif berarti sinyal naik saat teks memang AI.\n"
        "  Sinyal bertanda MATI layak dibuang: ia menyumbang bobot ke setiap\n"
        "  submission tanpa membedakan siapa pun."
    )


def print_length_check(rows: list[dict], labels: list[int]) -> None:
    if len(set(labels)) < 2:
        return
    human = [int(r["word_count"]) for r, y in zip(rows, labels) if y == 0]
    ai = [int(r["word_count"]) for r, y in zip(rows, labels) if y == 1]
    if not human or not ai:
        return
    gap = abs(sum(human) / len(human) - sum(ai) / len(ai))
    print(f"\nSelisih panjang rata rata manusia vs AI: {gap:.0f} kata")
    if gap > 30:
        print(
            "  Selisih sebesar ini membuat panjang teks jadi petunjuk gratis.\n"
            "  Sebagian dari AUC di atas kemungkinan berasal dari panjang,\n"
            "  bukan dari gaya."
        )
