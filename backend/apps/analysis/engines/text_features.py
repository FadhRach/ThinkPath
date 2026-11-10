"""Ekstraksi fitur teks: hanya mengukur, tidak memutuskan apa pun.

E1 (ai_score.py) dan E2 (bloom.py) sama-sama membaca TextFeatures dan tidak saling membaca hasil.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

# Klise khas LLM pada esai Indonesia (S2). Frasa akademik wajar ("dengan demikian") sengaja tidak dimasukkan.
LLM_PHRASES = (
    "perlu dicatat",
    "penting untuk dicatat",
    "dalam era",
    "di era modern",
    "di era digital",
    "sangat penting untuk",
    "secara fundamental",
    "secara holistik",
    "dapat dikonseptualisasikan",
    "memainkan peran penting",
    "tidak dapat dipungkiri",
    "seiring berjalannya waktu",
    "membuka jalan bagi",
    "di tengah dinamika",
    "dalam lanskap",
    "menjadi sorotan utama",
)

# Penanda suara orang pertama dan pengalaman konkret.
PERSONAL_MARKERS = (
    "saya",
    "penulis",
    "kami",
    "menurut saya",
    "pengalaman",
    "pernah",
    "di kelas",
    "saat praktikum",
    "dosen saya",
    "teman sekelompok",
    "mata kuliah",
    "waktu itu",
)

# Ragam informal, dicocokkan sebagai kata utuh ("sih" tidak cocok di "masih", "aja" di "saja").
INFORMAL_MARKERS = (
    "gak",
    "nggak",
    "engga",
    "banget",
    "kayak",
    "sih",
    "aja",
    "udah",
    "bikin",
    "yg",
    "dgn",
    "tdk",
)

# Penanda keraguan/kualifikasi (S4). Hipotesis: LLM menulis dengan kepastian datar; belum diuji data berlabel.
HEDGING_MARKERS = (
    "tampaknya",
    "kemungkinan",
    "cenderung",
    "agaknya",
    "barangkali",
    "belum tentu",
    "setidaknya",
    "sejauh ini",
    "harus diakui",
    "sayangnya",
    "masih perlu",
    "belum jelas",
    "diduga",
    "boleh jadi",
    "tidak selalu",
)

# Konektor sebab akibat. Penanda utama penalaran analitis.
CAUSAL_MARKERS = (
    "karena",
    "dikarenakan",  # berimbuhan kiri: pencocokan dari tepi kata tidak menangkapnya lewat "karena"
    "penyebab",
    "sebab",
    "akibatnya",
    "sehingga",
    "oleh karena itu",
    "menyebabkan",
    "disebabkan",
    "berdampak",
    "mengakibatkan",
    "sebagai akibat",
)

# Konektor pertentangan dan pembandingan.
CONTRAST_MARKERS = (
    "namun",
    "tetapi",
    "sebaliknya",
    "di sisi lain",
    "sedangkan",
    "berbeda dengan",
    "meskipun",
    "walaupun",
    "sementara itu",
    "dibandingkan",
    "perbedaan",
    "persamaan",
)

# Penanda sikap menilai disertai pembenaran.
EVALUATIVE_MARKERS = (
    "menurut saya",
    "menurutku",
    "lebih baik",
    "lebih efektif",
    "seharusnya",
    "sebaiknya",
    "kurang tepat",
    "paling tepat",
    "kelemahan",
    "kelebihan",
    "keunggulan",
    "kekurangan",
    "saya setuju",
    "saya tidak setuju",
    "argumen",
    "lebih masuk akal",
)

# Penanda merancang atau mengusulkan sesuatu yang baru.
CREATIVE_MARKERS = (
    "saya usulkan",
    "saya mengusulkan",
    "saya rancang",
    "rancangan",
    "solusi yang saya",
    "gagasan saya",
    "ide saya",
    "jika saya",
    "kalau saya",
    "saya akan membuat",
    "langkah yang saya susun",
    "alternatif baru",
    "saya kembangkan",
)

# Penanda pemakaian bukti atau contoh konkret.
EVIDENCE_MARKERS = (
    "misalnya",
    "contohnya",
    "sebagai contoh",
    "data menunjukkan",
    "berdasarkan",
    "menurut penelitian",
    "faktanya",
    "terbukti",
    "hasilnya",
)

# Penanda prosedur yang dijalankan (bukan sekadar daftar).
PROCEDURAL_MARKERS = (
    "langkah",
    "caranya",
    "cara kerjanya",
    "digunakan untuk",
    "dihitung dengan",
    "rumus",
    "dipraktikkan",
    "diterapkan",
    "prosedur",
)

# Penanda urutan, dipisah dari PROCEDURAL karena ambigu: bisa prosedur, bisa sekadar daftar.
ORDINAL_MARKERS = (
    "pertama",
    "kedua",
    "ketiga",
    "kemudian",
    "selanjutnya",
    "setelah itu",
    "terakhir",
)

# Penanda parafrase atau penjelasan ulang, ciri pemahaman.
EXPLANATORY_MARKERS = (
    "artinya",
    "yaitu",
    "dengan kata lain",
    "maksudnya",
    "dapat diartikan",
    "adalah proses",
    "merupakan",
    "berfungsi untuk",
    "bertujuan untuk",
)

# Kata kerja operasional Bloom revisi per level (pembagian proses kognitif Krathwohl 2002).
BLOOM_VERBS: dict[int, tuple[str, ...]] = {
    1: ("menyebutkan", "menuliskan", "menyatakan", "mengingat", "mendaftar",
        "menamai", "menunjukkan", "melabeli", "definisi", "pengertian"),
    2: ("menjelaskan", "menguraikan", "merangkum", "mencontohkan", "menerangkan",
        "mengartikan", "menceritakan", "mengelompokkan", "memahami",
        "membandingkan", "mengklasifikasikan"),
    3: ("menerapkan", "menghitung", "menggunakan", "menyelesaikan", "mempraktikkan",
        "mendemonstrasikan", "menghubungkan", "mengoperasikan", "menyusun langkah"),
    4: ("menganalisis", "membedakan", "menelaah", "menguji", "faktor",
        "hubungan antara", "mengapa"),
    5: ("menilai", "mengevaluasi", "mengkritik", "memutuskan", "mempertimbangkan",
        "membuktikan", "menyanggah", "mendukung", "membenarkan", "memeriksa"),
    6: ("merancang", "menciptakan", "memodifikasi", "mengusulkan", "mengembangkan",
        "merumuskan", "membangun", "mendesain", "menggabungkan"),
}

_SENTENCE_SPLIT = re.compile(r"[.!?]+")
_WORD_SPLIT = re.compile(r"[^\w']+", re.UNICODE)


@dataclass(frozen=True)
class TextFeatures:
    """Properti terukur dari satu teks jawaban. Tidak ada penilaian di sini."""

    word_count: int
    sentence_count: int
    mean_sentence_length: float
    burstiness: float
    type_token_ratio: float
    llm_phrase_count: int
    personal_count: int
    informal_count: int
    hedging_count: int
    causal_count: int
    contrast_count: int
    evaluative_count: int
    creative_count: int
    evidence_count: int
    procedural_count: int
    ordinal_count: int
    explanatory_count: int
    bloom_verb_hits: dict[int, int] = field(default_factory=dict)
    # Porsi kata fungsi bahasa Indonesia; penanda E1/E2 hanya mengenal bahasa Indonesia.
    indonesian_ratio: float = 1.0

    @property
    def marker_density(self) -> float:
        """Penanda penalaran per kata. Esai wajar jauh di bawah 0,25; daftar kata kunci di atasnya."""
        markers = (
            self.causal_count + self.contrast_count + self.evaluative_count
            + self.creative_count + self.procedural_count + self.ordinal_count
            + self.explanatory_count + sum(self.bloom_verb_hits.values())
        )
        return markers / self.word_count if self.word_count else 0.0

    @property
    def is_too_short(self) -> bool:
        """Di bawah ambang ini tidak ada sinyal yang layak dipercaya."""
        return self.word_count < 40


_INDONESIAN_FUNCTION_WORDS = frozenset(
    "yang dan di ke dari untuk dengan pada adalah ini itu dalam tidak akan atau juga "
    "sebagai dapat oleh karena sehingga bahwa ada lebih para saat".split()
)


def _indonesian_ratio(words: list[str]) -> float:
    if not words:
        return 0.0
    return sum(word in _INDONESIAN_FUNCTION_WORDS for word in words) / len(words)


def _split_sentences(text: str) -> list[str]:
    return [part.strip() for part in _SENTENCE_SPLIT.split(text) if part.strip()]


def _split_words(text: str) -> list[str]:
    return [word for word in _WORD_SPLIT.split(text.lower()) if word]


def _burstiness(sentences: list[str]) -> float:
    """Burstiness = min(1, stdev / mean) panjang kalimat (kata). Rendah = seragam."""
    if len(sentences) < 2:
        return 0.0
    lengths = [len(sentence.split()) for sentence in sentences]
    mean = sum(lengths) / len(lengths)
    if mean == 0:
        return 0.0
    variance = sum((length - mean) ** 2 for length in lengths) / len(lengths)
    return round(min(1.0, (variance ** 0.5) / mean), 3)


def _type_token_ratio(words: list[str]) -> float:
    """TTR = kata unik / jumlah kata pada 200 kata pertama (agar adil antar panjang teks)."""
    if not words:
        return 0.0
    window = words[:200]
    return round(len(set(window)) / len(window), 3)


@lru_cache(maxsize=None)
def _marker_pattern(markers: tuple[str, ...]) -> re.Pattern[str]:
    alternatives = sorted(markers, key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(re.escape(m) for m in alternatives) + ")")


def _count_markers(text_lower: str, markers: tuple[str, ...]) -> int:
    """Jumlah kemunculan penanda, dicocokkan dari tepi kiri kata, terpanjang dulu (tanpa hitung ganda)."""
    return len(_marker_pattern(markers).findall(text_lower))


def _count_distinct_markers(text_lower: str, markers: tuple[str, ...]) -> int:
    return sum(1 for marker in markers if marker in text_lower)


def _count_distinct_words(text_lower: str, markers: tuple[str, ...]) -> int:
    """Jumlah penanda berbeda yang muncul sebagai kata utuh ("saya" tidak cocok di "sayang")."""
    return sum(
        1
        for marker in markers
        if re.search(rf"\b{re.escape(marker)}\b", text_lower)
    )


def extract_features(text: str) -> TextFeatures:
    """Ukur satu teks jawaban menjadi TextFeatures."""
    text_lower = text.lower()
    sentences = _split_sentences(text)
    words = _split_words(text)
    lengths = [len(sentence.split()) for sentence in sentences]
    mean_length = round(sum(lengths) / len(lengths), 2) if lengths else 0.0

    bloom_verb_hits = {
        level: _count_distinct_markers(text_lower, verbs)
        for level, verbs in BLOOM_VERBS.items()
    }

    return TextFeatures(
        word_count=len(words),
        sentence_count=len(sentences),
        mean_sentence_length=mean_length,
        burstiness=_burstiness(sentences),
        type_token_ratio=_type_token_ratio(words),
        llm_phrase_count=_count_distinct_markers(text_lower, LLM_PHRASES),
        personal_count=_count_distinct_words(text_lower, PERSONAL_MARKERS),
        informal_count=_count_distinct_words(text_lower, INFORMAL_MARKERS),
        hedging_count=_count_distinct_words(text_lower, HEDGING_MARKERS),
        causal_count=_count_markers(text_lower, CAUSAL_MARKERS),
        contrast_count=_count_markers(text_lower, CONTRAST_MARKERS),
        evaluative_count=_count_distinct_markers(text_lower, EVALUATIVE_MARKERS),
        creative_count=_count_distinct_markers(text_lower, CREATIVE_MARKERS),
        evidence_count=_count_distinct_markers(text_lower, EVIDENCE_MARKERS),
        procedural_count=_count_distinct_markers(text_lower, PROCEDURAL_MARKERS),
        ordinal_count=_count_distinct_markers(text_lower, ORDINAL_MARKERS),
        explanatory_count=_count_distinct_markers(text_lower, EXPLANATORY_MARKERS),
        bloom_verb_hits=bloom_verb_hits,
        indonesian_ratio=_indonesian_ratio(words),
    )
