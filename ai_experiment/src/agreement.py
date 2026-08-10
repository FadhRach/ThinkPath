"""Kesepakatan antar penilai dan metrik klasifikasi bertingkat.

Dua hal yang menentukan bentuk berkas ini.

**Level Bloom adalah skala berurutan, bukan kategori lepas.** Cohen's kappa
biasa memperlakukan ketidaksepakatan C3 lawan C4 sama beratnya dengan C1 lawan
C6, padahal yang pertama nyaris sepakat dan yang kedua bertolak belakang. Kappa
berbobot kuadratik menghukum selisih jauh lebih berat daripada selisih dekat,
dan itulah ukuran yang benar untuk skala seperti ini. Keduanya dihitung: yang
biasa untuk dibandingkan dengan literatur, yang berbobot untuk gambaran jujur.

**Kesepakatan antar manusia adalah langit langit mesin.** Kalau dua penilai
hanya sepakat 65%, mesin yang mencapai 60% sudah nyaris menyentuh batas atas
tugas ini. Karena itu modul ini selalu melaporkan keduanya berdampingan.

Ditulis tanpa dependensi berat supaya bisa dijalankan siapa pun tanpa memasang
scikit-learn lebih dulu.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Urutan tetap. "X" (tak dapat dinilai) sengaja BUKAN bagian skala: ia bukan
# level nol, melainkan ketiadaan data, jadi harus dibuang sebelum dihitung.
BLOOM_LABELS = ("1", "2", "3", "4", "5", "6")
UNRATEABLE = "X"


@dataclass
class AgreementReport:
    n: int
    observed: float
    kappa: float
    weighted_kappa: float
    confusion: dict[tuple[str, str], int] = field(default_factory=dict)
    disagreements: list[tuple[str, str, str]] = field(default_factory=list)
    excluded: int = 0

    @property
    def interpretation(self) -> str:
        """Tafsir Landis dan Koch, dipakai luas di literatur pelabelan."""
        value = self.kappa
        if value < 0.0:
            return "lebih buruk daripada tebakan acak"
        if value < 0.20:
            return "sangat lemah"
        if value < 0.40:
            return "lemah"
        if value < 0.60:
            return "sedang"
        if value < 0.80:
            return "kuat"
        return "sangat kuat"


def _pairs(a: dict[str, str], b: dict[str, str]) -> list[tuple[str, str, str]]:
    """Pasangan label untuk item yang dinilai KEDUA penilai.

    Item yang salah satunya menandai X dibuang, bukan dihitung tidak sepakat.
    X berarti "tidak ada data", dan memaksanya masuk skala akan mengotori
    seluruh perhitungan.
    """
    shared = sorted(set(a) & set(b))
    return [
        (item, a[item], b[item])
        for item in shared
        if a[item] in BLOOM_LABELS and b[item] in BLOOM_LABELS
    ]


def _kappa(pairs: list[tuple[str, str, str]], weighted: bool) -> float:
    """Cohen's kappa, dengan opsi bobot kuadratik untuk skala berurutan."""
    n = len(pairs)
    if n == 0:
        return float("nan")

    labels = BLOOM_LABELS
    size = len(labels)
    index = {label: i for i, label in enumerate(labels)}

    def weight(i: int, j: int) -> float:
        if not weighted:
            return 0.0 if i == j else 1.0
        # Kuadratik: selisih dua tingkat dihukum empat kali lipat selisih satu.
        return ((i - j) / (size - 1)) ** 2

    count_a = [0] * size
    count_b = [0] * size
    observed = 0.0
    for _, first, second in pairs:
        i, j = index[first], index[second]
        count_a[i] += 1
        count_b[j] += 1
        observed += weight(i, j)
    observed /= n

    expected = 0.0
    for i in range(size):
        for j in range(size):
            expected += weight(i, j) * (count_a[i] / n) * (count_b[j] / n)

    if expected == 0:
        # Kedua penilai memberi label identik pada semuanya. Kesepakatan
        # sempurna, tetapi kappa tidak terdefinisi secara matematis.
        return 1.0 if observed == 0 else float("nan")
    return 1.0 - (observed / expected)


def compare_raters(a: dict[str, str], b: dict[str, str]) -> AgreementReport:
    """Bandingkan dua penilai. Kunci dict adalah id item, nilainya label."""
    pairs = _pairs(a, b)
    shared = len(set(a) & set(b))

    confusion: dict[tuple[str, str], int] = {}
    disagreements: list[tuple[str, str, str]] = []
    exact = 0
    for item, first, second in pairs:
        confusion[(first, second)] = confusion.get((first, second), 0) + 1
        if first == second:
            exact += 1
        else:
            disagreements.append((item, first, second))

    n = len(pairs)
    return AgreementReport(
        n=n,
        observed=exact / n if n else float("nan"),
        kappa=_kappa(pairs, weighted=False),
        weighted_kappa=_kappa(pairs, weighted=True),
        confusion=confusion,
        disagreements=sorted(
            disagreements, key=lambda d: -abs(int(d[1]) - int(d[2]))
        ),
        excluded=shared - n,
    )


@dataclass
class ClassificationReport:
    n: int
    accuracy: float
    macro_f1: float
    adjacent_accuracy: float
    per_label: dict[str, dict[str, float]] = field(default_factory=dict)
    confusion: dict[tuple[str, str], int] = field(default_factory=dict)


def score_predictions(
    gold: dict[str, str], predicted: dict[str, str]
) -> ClassificationReport:
    """Ukur sistem terhadap label acuan manusia.

    adjacent_accuracy ikut dilaporkan karena pada skala berurutan, meleset satu
    tingkat sangat berbeda artinya dari meleset tiga tingkat. Akurasi tepat saja
    menyembunyikan perbedaan itu.
    """
    pairs = _pairs(gold, predicted)
    n = len(pairs)

    confusion: dict[tuple[str, str], int] = {}
    exact = 0
    adjacent = 0
    for _, truth, guess in pairs:
        confusion[(truth, guess)] = confusion.get((truth, guess), 0) + 1
        if truth == guess:
            exact += 1
        if abs(int(truth) - int(guess)) <= 1:
            adjacent += 1

    per_label: dict[str, dict[str, float]] = {}
    f1_values = []
    for label in BLOOM_LABELS:
        tp = sum(c for (t, g), c in confusion.items() if t == label and g == label)
        fp = sum(c for (t, g), c in confusion.items() if t != label and g == label)
        fn = sum(c for (t, g), c in confusion.items() if t == label and g != label)
        support = tp + fn
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / support if support else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if (precision + recall)
            else 0.0
        )
        per_label[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support,
        }
        # Level yang tidak pernah muncul di acuan dikeluarkan dari rata rata.
        # Menyertakannya sebagai nol akan menghukum sistem karena ketiadaan
        # data, bukan karena kesalahannya.
        if support:
            f1_values.append(f1)

    return ClassificationReport(
        n=n,
        accuracy=exact / n if n else float("nan"),
        macro_f1=sum(f1_values) / len(f1_values) if f1_values else float("nan"),
        adjacent_accuracy=adjacent / n if n else float("nan"),
        per_label=per_label,
        confusion=confusion,
    )


def render_confusion(confusion: dict[tuple[str, str], int], row_title: str) -> str:
    """Matriks konfusi sebagai teks, siap ditempel ke laporan."""
    lines = [f"{row_title:<10}" + "".join(f"{label:>6}" for label in BLOOM_LABELS)]
    for truth in BLOOM_LABELS:
        cells = "".join(
            f"{confusion.get((truth, guess), 0):>6}" for guess in BLOOM_LABELS
        )
        lines.append(f"  C{truth:<7}" + cells)
    return "\n".join(lines)
