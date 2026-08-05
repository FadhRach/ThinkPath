"""Ekstraksi fitur teks jawaban siswa.

Modul ini sengaja dibuat murni deskriptif: ia hanya mengukur properti teks,
tidak memutuskan apa pun soal AI maupun level Bloom. Kebijakan skor ada di
ai_score.py (E1) dan bloom.py (E2), yang keduanya membaca fitur dari sini.

Pemisahan ini penting karena satu alasan: E1 dan E2 harus bisa dibuktikan
saling bebas. Selama keduanya hanya membaca TextFeatures dan tidak saling
membaca hasil, tidak mungkin ada ketergantungan melingkar di antara mereka.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# Frasa transisi yang khas dipakai LLM saat menulis esai formal Indonesia.
# Daftar ini bersifat indikatif, bukan bukti. Manusia juga memakainya.
LLM_PHRASES = (
    "perlu dicatat",
    "penting untuk dicatat",
    "dalam era",
    "di era modern",
    "sangat penting untuk",
    "secara fundamental",
    "secara holistik",
    "secara signifikan",
    "secara simultan",
    "terintegrasi",
    "dapat dikonseptualisasikan",
    "korelasi signifikan",
    "dengan demikian",
    "sebagai kesimpulan",
    "kesimpulannya",
    "hal ini menunjukkan bahwa",
    "berbagai faktor",
    "memainkan peran penting",
)

# Penanda suara orang pertama dan pengalaman konkret.
PERSONAL_MARKERS = (
    "saya",
    "aku",
    "menurutku",
    "menurut saya",
    "pengalaman",
    "saat itu",
    "waktu itu",
    "di rumah",
    "di sekolah saya",
    "teman saya",
    "pernah",
)

# Ragam informal yang praktis tidak pernah muncul di keluaran LLM formal.
INFORMAL_MARKERS = (
    "gak ",
    "nggak",
    "engga",
    "banget",
    "kayak",
    "sih ",
    "aja ",
    "udah",
    "bikin",
    "yg ",
    "dgn ",
    "tdk ",
    "krn ",
    "utk ",
    "jd ",
)

# Konektor sebab akibat. Penanda utama penalaran analitis.
CAUSAL_MARKERS = (
    "karena",
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

# Penanda penerapan sesungguhnya: ada prosedur yang dijalankan, bukan sekadar
# daftar yang diurutkan.
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

# Penanda urutan. Sengaja dipisah dari PROCEDURAL_MARKERS karena ambigu:
# "pertama, kedua, ketiga" bisa berarti menjalankan prosedur, bisa juga sekadar
# mendaftar isi catatan. Sendirian, penanda ini bukan bukti penerapan.
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

# Kata kerja operasional per level Bloom revisi (Anderson dan Krathwohl).
# Dipakai bloom.py sebagai salah satu sumber bukti, bukan satu-satunya.
BLOOM_VERBS: dict[int, tuple[str, ...]] = {
    1: ("menyebutkan", "menuliskan", "menyatakan", "mengingat", "mendaftar",
        "menamai", "menunjukkan", "melabeli", "definisi", "pengertian"),
    2: ("menjelaskan", "menguraikan", "merangkum", "mencontohkan", "menerangkan",
        "mengartikan", "menceritakan", "mengelompokkan", "memahami"),
    3: ("menerapkan", "menghitung", "menggunakan", "menyelesaikan", "mempraktikkan",
        "mendemonstrasikan", "menghubungkan", "mengoperasikan", "menyusun langkah"),
    4: ("menganalisis", "membandingkan", "membedakan", "mengklasifikasikan",
        "memeriksa", "menelaah", "menguji", "faktor", "hubungan antara", "mengapa"),
    5: ("menilai", "mengevaluasi", "mengkritik", "memutuskan", "mempertimbangkan",
        "membuktikan", "menyanggah", "mendukung", "membenarkan"),
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
    causal_count: int
    contrast_count: int
    evaluative_count: int
    creative_count: int
    evidence_count: int
    procedural_count: int
    ordinal_count: int
    explanatory_count: int
    bloom_verb_hits: dict[int, int] = field(default_factory=dict)

    @property
    def is_too_short(self) -> bool:
        """Di bawah ambang ini tidak ada sinyal yang layak dipercaya."""
        return self.word_count < 25


def _split_sentences(text: str) -> list[str]:
    return [part.strip() for part in _SENTENCE_SPLIT.split(text) if part.strip()]


def _split_words(text: str) -> list[str]:
    return [word for word in _WORD_SPLIT.split(text.lower()) if word]


def _burstiness(sentences: list[str]) -> float:
    """Rasio simpangan baku panjang kalimat terhadap rataannya.

    Nilai rendah berarti panjang kalimat seragam. Teks LLM cenderung seragam,
    tulisan manusia cenderung bervariasi. Dinormalisasi ke rentang 0 sampai 1.
    """
    if len(sentences) < 2:
        return 0.0
    lengths = [len(sentence.split()) for sentence in sentences]
    mean = sum(lengths) / len(lengths)
    if mean == 0:
        return 0.0
    variance = sum((length - mean) ** 2 for length in lengths) / len(lengths)
    return round(min(1.0, (variance ** 0.5) / mean), 3)


def _type_token_ratio(words: list[str]) -> float:
    """Keragaman kosakata. Dihitung pada 200 kata pertama supaya adil.

    Tanpa pembatasan panjang, TTR selalu turun seiring teks memanjang, sehingga
    teks panjang otomatis terlihat miskin kosakata. Pembatasan jendela membuat
    nilainya bisa dibandingkan antar jawaban dengan panjang berbeda.
    """
    if not words:
        return 0.0
    window = words[:200]
    return round(len(set(window)) / len(window), 3)


def _count_markers(text_lower: str, markers: tuple[str, ...]) -> int:
    return sum(text_lower.count(marker) for marker in markers)


def _count_distinct_markers(text_lower: str, markers: tuple[str, ...]) -> int:
    return sum(1 for marker in markers if marker in text_lower)


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
        personal_count=_count_distinct_markers(text_lower, PERSONAL_MARKERS),
        informal_count=_count_distinct_markers(text_lower, INFORMAL_MARKERS),
        causal_count=_count_markers(text_lower, CAUSAL_MARKERS),
        contrast_count=_count_markers(text_lower, CONTRAST_MARKERS),
        evaluative_count=_count_distinct_markers(text_lower, EVALUATIVE_MARKERS),
        creative_count=_count_distinct_markers(text_lower, CREATIVE_MARKERS),
        evidence_count=_count_distinct_markers(text_lower, EVIDENCE_MARKERS),
        procedural_count=_count_distinct_markers(text_lower, PROCEDURAL_MARKERS),
        ordinal_count=_count_distinct_markers(text_lower, ORDINAL_MARKERS),
        explanatory_count=_count_distinct_markers(text_lower, EXPLANATORY_MARKERS),
        bloom_verb_hits=bloom_verb_hits,
    )
