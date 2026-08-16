"""Kerangka bersama untuk skrip yang membandingkan satu mesin skor E1 terhadap heuristik.

evaluate_detector.py mengukur lapis pertama rantai, evaluate_groq.py mengukur
lapis kedua. Keduanya menjawab pertanyaan yang berbeda tetapi memakai kerangka
yang sama persis: ambil subset seimbang dari gold set, skor dengan dua mesin
pada baris yang SAMA, lalu laporkan perbandingannya.

Kerangka itu tadinya disalin di antara kedua berkas, dan dua salinan aturan yang
sama pasti akan berbeda seiring waktu. Dua yang paling berbahaya kalau sampai
berbeda:

1. **Penyeimbangan sampel.** Kalau satu skrip menyeimbangkan manusia dan AI
   sementara yang lain tidak, ROC-AUC keduanya tidak bisa dibandingkan sama
   sekali, dan tidak ada yang akan menyadarinya karena angkanya sama sama
   terlihat wajar.
2. **Definisi ambang aman.** Dua skrip yang melaporkan baris "ambang yang
   menjaga FPR di bawah 5 persen" dengan perhitungan berbeda akan terlihat bisa
   diperbandingkan padahal tidak.

Yang TIDAK ditaruh di sini: cara memanggil penyedia. Detektor menagih per kata
sementara Groq dibatasi token per hari, dan penanganan kegagalan keduanya memang
harus berbeda. Menyeragamkannya akan menyembunyikan perbedaan yang justru
penting.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .config import ensure_dirs
from .metrics import confusion_at, pearson, roc_auc, threshold_at_max_fpr

# Ambang yang dipakai produksi sekarang. Dicetak untuk kedua mesin supaya
# terlihat apakah ambang yang sama masuk akal untuk keduanya. Hampir pasti
# tidak, dan itulah yang ingin ditunjukkan.
CURRENT_MID_THRESHOLD = 35
CURRENT_HIGH_THRESHOLD = 70

MAX_ACCEPTABLE_FPR = 0.05


class ScoreCache:
    """Skor yang sudah pernah dibayar atau pernah menghabiskan kuota.

    Menjalankan ulang skrip evaluasi TIDAK boleh membayar dua kali. Itu bukan
    optimisasi, melainkan syarat supaya kalibrasi bisa dikerjakan bertahap
    lintas hari: kredit detektor terpakai per kata, dan jatah token Groq
    dihitung per hari.

    Berkasnya JSONL dan ditambah baris demi baris, bukan ditulis ulang di akhir.
    Proses yang mati di tengah jalan tetap meninggalkan seluruh skor yang sudah
    terambil.
    """

    def __init__(self, path: Path) -> None:
        self.path = path

    @staticmethod
    def key(*parts: str) -> str:
        """Kunci dari bagian bagian yang menentukan identitas satu skor.

        Selalu sertakan apa pun yang membuat skornya berbeda, bukan hanya
        teksnya. Model dan versi termasuk: tanpa itu, mengganti model akan
        membaca skor model lama dari cache dan melaporkannya sebagai hasil model
        baru.
        """
        return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()

    def load(self) -> dict[str, float]:
        if not self.path.exists():
            return {}
        cache: dict[str, float] = {}
        with self.path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                    cache[row["key"]] = float(row["score"])
                except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                    # Baris rusak diabaikan, bukan menggagalkan seluruh proses.
                    # Cache adalah penghemat biaya, bukan sumber kebenaran.
                    continue
        return cache

    def append(self, key: str, score: float) -> None:
        ensure_dirs()
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"key": key, "score": score}) + "\n")


def balanced_sample(rows: list[dict], limit: int) -> list[dict]:
    """Ambil separuh manusia separuh AI, berselang seling, deterministik.

    Gold set tersimpan terurut: seluruh baris manusia lebih dulu, baru baris AI.
    Tanpa penyeimbangan ini, --limit kecil akan mengambil teks manusia saja dan
    ROC-AUC tidak terdefinisi.

    **Selang selingnya sama pentingnya dengan penyeimbangannya.** Kedua skrip
    yang memakai fungsi ini pasti berhenti di tengah jalan: kredit detektor
    habis, atau jatah token harian Groq tersentuh. Kalau urutan prosesnya
    dikembalikan ke urutan gold set, seluruh baris manusia diskor lebih dulu,
    sehingga proses yang terhenti meninggalkan cache berisi satu kelas saja.
    Cache-nya terlihat terisi dan tetap tidak bisa menghasilkan satu angka pun,
    dan itu baru ketahuan setelah kuotanya habis. Dengan berselang seling,
    potongan seberapa pun dari awal selalu kira kira seimbang, jadi kalibrasi
    yang dicicil lintas hari benar benar bisa dikerjakan.

    Deterministik supaya menjalankan ulang skrip memakai sampel yang sama persis
    dan cache-nya benar benar terpakai.
    """
    if limit <= 0 or limit >= len(rows):
        return rows
    human = [row for row in rows if row["binary_label"] == 0]
    ai = [row for row in rows if row["binary_label"] == 1]
    half = limit // 2
    picked_human = human[:half]
    picked_ai = ai[: limit - half]

    interleaved: list[dict] = []
    for human_row, ai_row in zip(picked_human, picked_ai):
        interleaved.append(human_row)
        interleaved.append(ai_row)
    # Sisa dari kelas yang lebih banyak, muncul kalau limit ganjil atau kalau
    # salah satu kelas tidak cukup untuk mengisi jatahnya.
    interleaved.extend(picked_human[len(picked_ai):])
    interleaved.extend(picked_ai[len(picked_human):])
    return interleaved


def print_engine_comparison(
    engine_name: str,
    engine_scores: list[float],
    heuristic_scores: list[float],
    labels: list[int],
    *,
    subheading: str = "",
    worse_note: str = "",
    footer: str = "",
) -> None:
    """Laporkan satu mesin berdampingan dengan heuristik, pada subset yang sama.

    Kedua skor WAJIB berasal dari baris yang sama persis. Membandingkan angka
    satu mesin pada 40 sampel terhadap angka heuristik pada 972 sampel yang
    sudah tercatat di README adalah perbandingan yang tidak sah, dan godaannya
    besar justru karena angka itu sudah ada.
    """
    n_ai = sum(labels)
    n_human = len(labels) - n_ai
    print(f"\nSampel: {len(labels)} ({n_human} manusia, {n_ai} AI)")

    if n_ai == 0 or n_human == 0:
        raise SystemExit(
            "Hanya ada satu kelas pada subset ini. Metrik pemisahan tidak bisa\n"
            "dihitung. Perbesar --limit atau bangun sisi AI gold set lebih dulu."
        )

    engines = ((engine_name, engine_scores), ("Heuristik", heuristic_scores))
    width = max(len(name) for name, _ in engines)

    if subheading:
        print(f"\n{subheading}")

    print("\nROC-AUC pada subset yang sama persis")
    aucs = {}
    for name, scores in engines:
        auc = roc_auc(scores, labels)
        aucs[name] = auc
        print(f"  {name:<{width}} {auc:.3f}")

    selisih = aucs[engine_name] - aucs["Heuristik"]
    print(f"\n  Selisih: {selisih:+.3f} untuk {engine_name}.")
    if selisih <= 0 and worse_note:
        print(worse_note)
    elif 0 < selisih < 0.05:
        print(
            "  Selisihnya tipis. Pada sampel sekecil ini, selisih setipis itu\n"
            "  belum tentu nyata. Perbesar --limit sebelum mengambil keputusan."
        )

    print("\nPada ambang yang dipakai produksi sekarang")
    print(
        f"  {'mesin':<{width}} {'ambang':>7} {'F1':>7} {'presisi':>8} "
        f"{'recall':>7} {'FPR':>7}"
    )
    for name, scores in engines:
        for threshold in (CURRENT_MID_THRESHOLD, CURRENT_HIGH_THRESHOLD):
            report = confusion_at(scores, labels, threshold)
            print(
                f"  {name:<{width}} {threshold:>7} {report.f1:>7.3f} "
                f"{report.precision:>8.3f} {report.recall:>7.3f} "
                f"{report.false_positive_rate:>7.3f}"
            )

    print(
        f"\nAmbang yang menjaga FPR di bawah {MAX_ACCEPTABLE_FPR:.0%}"
    )
    for name, scores in engines:
        threshold, report = threshold_at_max_fpr(
            scores, labels, max_fpr=MAX_ACCEPTABLE_FPR
        )
        print(
            f"  {name:<{width}} skor >= {threshold:<4} recall {report.recall:.3f}, "
            f"FPR {report.false_positive_rate:.3f}, "
            f"{report.false_positive} dari "
            f"{report.false_positive + report.true_negative} manusia tertuduh"
        )
    if footer:
        print(footer)

    print("\nKorelasi terhadap label")
    for name, scores in engines:
        print(f"  {name:<{width}} {pearson(scores, [float(y) for y in labels]):+.3f}")


def print_register_caveat(*extra_paragraphs: str) -> None:
    """Peringatan register, dicetak di keluaran dan bukan hanya ditulis di README.

    Yang membaca angka biasanya tidak sedang membaca dokumen.
    """
    paragraphs = [
        "Gold set ini berisi ABSTRAK AKADEMIK, sedangkan ThinkPath menilai ESAI\n"
        "MAHASISWA. Keduanya register yang berbeda, dan selisihnya sudah terukur:\n"
        "penanda personal 0,210 per teks pada abstrak versus 1,859 pada esai\n"
        "mahasiswa. Ketidakcocokan itu yang membuat tiga dari lima sinyal\n"
        "heuristik diam sepanjang pengukuran sebelumnya.",
        *extra_paragraphs,
        "Yang BOLEH disimpulkan dari angka di atas: mana yang lebih memisahkan\n"
        "manusia dari AI, pada teks Indonesia, pada register ini.",
        "Yang TIDAK boleh disimpulkan: bahwa itu akurasi ThinkPath pada jawaban\n"
        "mahasiswa. Untuk itu dibutuhkan gold set beregister esai mahasiswa, dan\n"
        "menambah abstrak berapa pun banyaknya tidak akan menggantikannya.",
    ]
    print("\nPERINGATAN, BACA SEBELUM MENGUTIP ANGKA DI ATAS\n")
    print("\n\n".join(paragraphs))
