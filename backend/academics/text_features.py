"""Ekstraksi fitur teks jawaban mahasiswa.

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

# Frasa yang khas dipakai LLM saat menulis esai formal Indonesia.
#
# Daftar ini DIPANGKAS saat fokus produk pindah ke mahasiswa. Sebelumnya ia
# memuat "dengan demikian", "hal ini menunjukkan bahwa", "berbagai faktor",
# "secara signifikan", "sebagai kesimpulan", dan "korelasi signifikan". Semua
# itu bahasa Indonesia akademik yang benar dan dipakai penulis manusia setiap
# hari. Menghitungnya sebagai jejak AI berarti menghukum mahasiswa karena
# menulis dengan baik, dan uji jalan memang menunjukkan esai akademik tulisan
# manusia ikut tertuduh karenanya.
#
# Yang tersisa adalah klise yang jarang muncul di tulisan akademik sungguhan.
# Daftar ini tetap indikatif, bukan bukti, dan wajib diuji ulang lewat
# ai_experiment sebelum bobotnya dipercaya.
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

# Ragam informal. Dipertahankan karena kalau muncul memang bukti kuat tulisan
# manusia, tetapi TIDAK lagi diandalkan sebagai sinyal utama: mahasiswa yang
# menulis esai formal tidak akan memakainya sama sekali, sehingga nilainya
# konstan untuk seluruh populasi dan tidak membedakan siapa pun.
# Dicocokkan sebagai KATA UTUH, bukan potongan. Sebelumnya daftar ini memakai
# spasi di belakang seperti "sih " dan "aja " sebagai pengganti batas kata, tapi
# itu hanya menjaga sisi kanan. Akibatnya "sih " cocok di dalam "masih" dan
# "aja " cocok di dalam "saja", dua kata yang ada di hampir setiap teks formal,
# sehingga teks akademik murni tercatat punya ragam informal.
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

# Penanda keraguan dan kualifikasi. Inilah pengganti utama INFORMAL_MARKERS
# untuk register akademik.
#
# Hipotesisnya: manusia yang benar benar memikirkan sesuatu akan ragu, memberi
# syarat, dan mengakui batas argumennya. LLM cenderung menulis dengan kepastian
# rata dan selalu seimbang. Hipotesis ini BELUM diuji terhadap data berlabel,
# dan itulah yang dikerjakan notebook diagnostik di ai_experiment.
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

    @property
    def is_too_short(self) -> bool:
        """Di bawah ambang ini tidak ada sinyal yang layak dipercaya."""
        return self.word_count < 40


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


def _count_distinct_words(text_lower: str, markers: tuple[str, ...]) -> int:
    """Sama seperti _count_distinct_markers, tetapi menuntut batas kata.

    Dipakai untuk penanda yang berupa kata lepas, di mana pencocokan potongan
    menghasilkan positif palsu yang serius: "sih" di dalam "masih", "aja" di
    dalam "saja", "kami" di dalam "kamis", "saya" di dalam "sayang".

    Frasa berspasi seperti "menurut saya" tetap bekerja karena \\b hanya
    memeriksa tepi kiri dan kanan seluruh pola.
    """
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
    )
