"""E1: skor indikasi penggunaan AI generatif.

PERINGATAN KEJUJURAN, WAJIB DIBACA SEBELUM MENGKLAIM ANGKA APA PUN.

Modul ini adalah baseline heuristik yang dapat dijelaskan, BUKAN detektor
tervalidasi. Bobot di bawah ditetapkan dari penalaran, bukan dari kalibrasi
terhadap data berlabel. Sampai tim punya gold set jawaban siswa Indonesia yang
dilabeli manusia, tidak boleh ada klaim akurasi, presisi, atau recall dari
modul ini.

Yang boleh diklaim: skor ini menghitung beberapa sinyal yang saling bebas, dan
melaporkan kontribusi tiap sinyal supaya guru bisa menilai sendiri alasannya.
Yang tidak boleh diklaim: bahwa skor 78 berarti 78 persen kemungkinan AI.

Ada lima sinyal berbasis teks, ditambah satu sinyal forensik proses bila
metadata pengerjaan tersedia (lihat process_signals.py). Sinyal proses adalah
yang paling sulit dipalsukan karena tidak membaca teks sama sekali, sehingga
parafrase tidak menghapusnya.

Riset yang mendasari kehati hatian ini: detektor teks AI menandai tulisan
penulis non-native jauh lebih sering daripada penulis native, dan pada korpus
multibahasa M4GT-Bench performa untuk bahasa Indonesia berada jauh di bawah
bahasa Inggris. Karena itu keluaran modul ini diposisikan sebagai bahan tinjau
guru, bukan vonis.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from .models import AiBand
from .process_signals import ProcessContext, evaluate_process
from .text_features import TextFeatures


@dataclass(frozen=True)
class SignalScore:
    """Satu sinyal independen beserta kontribusinya ke skor akhir."""

    key: str
    label: str
    value: float
    weight: float
    evidence: str

    @property
    def contribution(self) -> float:
        return round(self.value * self.weight * 100, 1)

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "value": round(self.value, 3),
            "weight": self.weight,
            "contribution": self.contribution,
            "evidence": self.evidence,
        }


@dataclass(frozen=True)
class AiScoreResult:
    score: int
    band: str
    breakdown: list[SignalScore]

    @property
    def evidence_lines(self) -> list[str]:
        """Sinyal berkontribusi terbesar lebih dulu, maksimal empat baris."""
        ranked = sorted(self.breakdown, key=lambda s: s.contribution, reverse=True)
        return [signal.evidence for signal in ranked[:4]]

    def breakdown_as_dicts(self) -> list[dict]:
        return [signal.as_dict() for signal in self.breakdown]


# Bobot sinyal berbasis teks. Jumlahnya harus 1.0, dijaga oleh test.
# Angka ini adalah titik awal yang harus dikalibrasi ulang begitu gold set ada.
TEXT_WEIGHTS = {
    "uniformity": 0.30,
    "formulaic_phrasing": 0.25,
    "impersonality": 0.20,
    "mechanical_polish": 0.15,
    "lexical_uniformity": 0.10,
}

# Porsi sinyal forensik proses ketika metadata pengerjaan tersedia. Sisa bobot
# dibagi ke sinyal teks secara proporsional, sehingga totalnya tetap 1.0.
#
# Angkanya sengaja 0.25, lebih besar dari sinyal teks mana pun: sinyal proses
# adalah satu satunya yang tidak bisa dihapus dengan parafrase. Tetapi tidak
# dibuat dominan, karena ia juga kasar. Siswa yang mengetik cepat atau menyusun
# jawaban di aplikasi lain sebelum menempelkannya bukan penyontek.
PROCESS_WEIGHT = 0.25

# Dipertahankan agar impor lama tidak patah.
WEIGHTS = TEXT_WEIGHTS


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _signal_uniformity(features: TextFeatures) -> SignalScore:
    """Keseragaman panjang kalimat. Burstiness rendah berarti seragam."""
    if features.sentence_count < 3:
        value = 0.5
        evidence = "Jumlah kalimat terlalu sedikit untuk menilai variasi panjang"
    else:
        value = _clamp01(1.0 - (features.burstiness / 0.6))
        if value > 0.6:
            evidence = (
                f"Panjang kalimat seragam, variasi hanya {features.burstiness:.2f} "
                f"dari rata rata {features.mean_sentence_length:.0f} kata"
            )
        else:
            evidence = (
                f"Panjang kalimat bervariasi wajar, variasi {features.burstiness:.2f}"
            )
    return SignalScore(
        key="uniformity",
        label="Keseragaman kalimat",
        value=value,
        weight=TEXT_WEIGHTS["uniformity"],
        evidence=evidence,
    )


def _signal_formulaic_phrasing(features: TextFeatures) -> SignalScore:
    """Kepadatan frasa transisi formulaik yang khas keluaran LLM."""
    value = _clamp01(features.llm_phrase_count / 4.0)
    if features.llm_phrase_count == 0:
        evidence = "Tidak ditemukan frasa transisi formulaik"
    else:
        evidence = (
            f"Ditemukan {features.llm_phrase_count} jenis frasa transisi formulaik"
        )
    return SignalScore(
        key="formulaic_phrasing",
        label="Frasa formulaik",
        value=value,
        weight=TEXT_WEIGHTS["formulaic_phrasing"],
        evidence=evidence,
    )


def _signal_impersonality(features: TextFeatures) -> SignalScore:
    """Ketiadaan suara orang pertama dan contoh dari pengalaman sendiri."""
    voice = features.personal_count + features.evidence_count
    value = _clamp01(1.0 - (voice / 3.0))
    if voice == 0:
        evidence = "Tidak ada sudut pandang pribadi maupun contoh konkret"
    else:
        evidence = f"Ada {voice} penanda sudut pandang pribadi atau contoh konkret"
    return SignalScore(
        key="impersonality",
        label="Ketiadaan suara personal",
        value=value,
        weight=TEXT_WEIGHTS["impersonality"],
        evidence=evidence,
    )


def _signal_mechanical_polish(features: TextFeatures) -> SignalScore:
    """Kerapian mekanis. Tulisan siswa biasanya menyisakan ragam informal.

    Sinyal ini yang paling perlu diwaspadai: siswa yang memang rapi menulis
    akan tampak seperti AI. Bobotnya sengaja dijaga rendah karena itu.
    """
    value = _clamp01(1.0 - (features.informal_count / 2.0))
    if features.informal_count == 0:
        evidence = "Tidak ada ragam informal, seluruh teks memakai ragam baku"
    else:
        evidence = f"Ada {features.informal_count} ragam informal khas tulisan siswa"
    return SignalScore(
        key="mechanical_polish",
        label="Kerapian mekanis",
        value=value,
        weight=TEXT_WEIGHTS["mechanical_polish"],
        evidence=evidence,
    )


def _signal_lexical_uniformity(features: TextFeatures) -> SignalScore:
    """Keragaman kosakata di luar rentang wajar tulisan siswa.

    Nilai ekstrem di kedua arah sama sama mencurigakan, jadi jarak dari titik
    tengah wajar yang dipakai, bukan nilai mentahnya.
    """
    if features.word_count < 40:
        value = 0.5
        evidence = "Teks terlalu pendek untuk menilai keragaman kosakata"
    else:
        deviation = abs(features.type_token_ratio - 0.62) / 0.25
        value = _clamp01(deviation)
        evidence = (
            f"Keragaman kosakata {features.type_token_ratio:.2f} "
            f"pada {features.word_count} kata"
        )
    return SignalScore(
        key="lexical_uniformity",
        label="Keragaman kosakata",
        value=value,
        weight=TEXT_WEIGHTS["lexical_uniformity"],
        evidence=evidence,
    )


def score_to_band(ai_score: int) -> str:
    if ai_score < 35:
        return AiBand.LOW
    if ai_score < 70:
        return AiBand.MID
    return AiBand.HIGH


def build_process_signal(context: ProcessContext) -> SignalScore:  # noqa: D401
    """Forensik proses pengerjaan. Satu satunya sinyal yang tidak membaca teks."""
    value, evidence = evaluate_process(context)
    return SignalScore(
        key="process_forensics",
        label="Forensik proses",
        value=value,
        weight=PROCESS_WEIGHT,
        evidence=evidence,
    )


def score_ai_probability(
    features: TextFeatures, process: ProcessContext | None = None
) -> AiScoreResult:
    """Hitung skor indikasi AI dari fitur teks dan, bila ada, metadata proses.

    Tidak membaca level Bloom maupun target guru. Ini yang menjamin E1 dan E2
    tetap saling bebas.

    Ketika metadata proses tersedia, bobot sinyal teks diciutkan proporsional
    supaya total bobot tetap 1.0. Tanpa penciutan itu, skor submission yang
    punya metadata akan otomatis lebih tinggi daripada yang tidak, hanya karena
    jumlah sinyalnya lebih banyak.
    """
    text_signals = [
        _signal_uniformity(features),
        _signal_formulaic_phrasing(features),
        _signal_impersonality(features),
        _signal_mechanical_polish(features),
        _signal_lexical_uniformity(features),
    ]

    if process is None:
        breakdown = text_signals
    else:
        scale = 1.0 - PROCESS_WEIGHT
        breakdown = [
            replace(signal, weight=round(signal.weight * scale, 4))
            for signal in text_signals
        ]
        breakdown.append(build_process_signal(process))

    raw = sum(signal.value * signal.weight for signal in breakdown)
    score = int(round(_clamp01(raw) * 100))
    return AiScoreResult(score=score, band=score_to_band(score), breakdown=breakdown)

