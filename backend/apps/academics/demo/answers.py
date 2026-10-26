"""Mahasiswa demo dan generator jawaban mereka.

Jawaban disusun dari kalimat berpola yang diisi slot topik tiap tugas (`demo/courses.py`), jadi
isinya sesuai mata kuliah. Tiga gaya menulis meniru tiga pola yang ingin ditunjukkan demo:

- "manusia": suara orang pertama, keraguan, rujukan ke kelas dan praktikum, panjang kalimat beragam;
- "campur": sebagian baku, sebagian masih bersuara penulis;
- "ai": baku, frasa klise, tanpa keraguan; sebagian menyisakan jejak obrolan (poin "•", "semoga
  membantu").

Kedalaman (0 dangkal, 1 sedang, 2 mendalam) menentukan berapa kalimat penalaran yang dipakai, dan
itu yang dibaca level Bloom. Gaya dan kedalaman sengaja tidak berkorelasi: ada mahasiswa jujur
yang dangkal dan ada pengguna AI yang argumennya rapi.

Variasi `[a|b]` dipilih acak per mahasiswa supaya dua jawaban tidak berbagi kalimat yang sama
persis; kemiripan tinggi hanya muncul pada pasangan salin yang memang disengaja.
"""
from __future__ import annotations

import random
import re
from dataclasses import dataclass

from apps.analysis.choices import AiBand


@dataclass(frozen=True)
class Persona:
    name: str
    band: str  # AiBand: gaya menulis
    trajectory: str  # kuat, sedang, lemah, naik, turun
    minutes: tuple[int, int]
    style: str  # tulis, campur, tempel (cara kata muncul di rekaman proses)
    revises: bool
    skip: float  # peluang tidak mengumpulkan tugas yang sudah lewat tenggat
    doc_pref: float  # peluang mengunggah PDF bila dosen mengizinkan
    leaky: float = 0.0  # peluang menyisakan jejak obrolan (khusus gaya ai)


L, M, H = AiBand.LOW, AiBand.MID, AiBand.HIGH

# Urutan = mhs01..mhs20. Indeks 5, 6, 7 dipakai seed Cek Paham, jadi tidak pernah absen.
STUDENTS = (
    Persona("Aditya Pratama", L, "naik", (25, 45), "tulis", False, 0.0, 0.5),
    Persona("Nabila Putri Ramadhani", L, "kuat", (35, 60), "tulis", True, 0.0, 0.7),
    Persona("Bagas Saputra", L, "lemah", (15, 30), "tulis", False, 0.18, 0.3),
    Persona("Siti Aisyah Nurhaliza", L, "kuat", (30, 55), "tulis", False, 0.0, 0.8),
    Persona("Kevin Wijaya", M, "sedang", (8, 15), "campur", False, 0.05, 0.5),
    Persona("Dewi Lestari Anggraini", L, "sedang", (25, 45), "tulis", True, 0.0, 0.6),
    Persona("Rizky Maulana", H, "lemah", (2, 5), "tempel", False, 0.0, 0.2, 0.5),
    Persona("Clarissa Tanoto", H, "kuat", (2, 6), "tempel", False, 0.0, 0.4, 0.2),
    Persona("Fajar Nugroho", L, "turun", (20, 40), "tulis", False, 0.1, 0.4),
    Persona("Intan Permatasari", L, "naik", (25, 50), "tulis", True, 0.0, 0.6),
    Persona("Muhammad Farhan Hakim", M, "naik", (10, 18), "campur", False, 0.05, 0.5),
    Persona("Putu Ayu Wulandari", L, "sedang", (25, 40), "tulis", False, 0.0, 0.7),
    Persona("Yohanes Kristianto", M, "lemah", (8, 14), "campur", False, 0.2, 0.3),
    Persona("Annisa Rahmawati", L, "kuat", (30, 55), "tulis", True, 0.0, 0.6),
    Persona("Dimas Arya Wicaksono", H, "sedang", (3, 6), "tempel", False, 0.1, 0.3, 0.3),
    Persona("Theresia Natalia", L, "naik", (20, 40), "tulis", False, 0.0, 0.5),
    Persona("Andi Muhammad Akbar", M, "turun", (8, 16), "campur", True, 0.05, 0.4),
    Persona("Salsabila Azzahra", L, "sedang", (22, 45), "tulis", False, 0.0, 0.6),
    Persona("Gilang Ramadhan", H, "turun", (2, 5), "tempel", False, 0.15, 0.2, 0.4),
    Persona("Maria Fransiska Sitorus", M, "kuat", (10, 20), "campur", False, 0.0, 0.5),
)

_POOLS = {
    L: {
        "open": [
            "Dari materi {topic} [minggu ini|kemarin|di pertemuan ini], bagian yang paling saya tangkap adalah {c0}.",
            "Jujur awalnya saya [agak|cukup] bingung dengan {topic}, terutama soal {c1}.",
            "Saya mulai mengerjakan tugas ini dari contoh yang dibahas di kelas, yaitu {ex}.",
            "Waktu praktikum saya sempat mencoba {ex}, dan dari situ {topic} jadi lebih masuk akal [buat|bagi] saya.",
            "Sebelum menulis ini saya membaca ulang catatan [mata kuliah|kuliah] tentang {topic}.",
            "Topik {topic} ternyata tidak sesederhana yang saya kira [di awal|waktu pertama dijelaskan].",
            "Saya mengerjakan tugas ini [sambil membuka slide|setelah menonton ulang rekaman kelas] supaya tidak salah paham soal {c0}.",
        ],
        "shallow": [
            "Yang saya catat dari slide, ada {c0}, {c1}, dan {c2}.",
            "Ada juga {c3}, tapi bagian ini [belum terlalu|masih belum] saya pahami.",
            "Di kelas disebutkan bahwa {c1} itu penting, walaupun saya belum bisa menjelaskan alasannya dengan lengkap.",
            "Contoh yang [diberikan|dibahas] dosen adalah {ex}.",
            "Kalau saya rangkum, intinya {topic} berhubungan dengan {c0} dan {c2}.",
            "Saya masih perlu latihan lagi untuk bagian {c3}.",
            "Bagian {c2} [sempat|masih] membuat saya ragu.",
            "Saya bertanya ke teman sekelompok soal {c1}, dan jawabannya cukup membantu.",
            "Jujur, ini bagian [tersulit|paling lama saya pahami].",
            "Waktu itu saya sempat salah paham dan mengira {c0} sama dengan {c2}, padahal setelah dicoba lagi ternyata keduanya dipakai untuk hal yang berbeda.",
        ],
        "deep": [
            "Untuk kasus {ex}, saya memilih {pick} [dibanding|daripada] {alt}, karena {why}.",
            "{Alt} memang [lebih mudah|lebih cepat] dibuat, tetapi akan bermasalah ketika {c2} mulai berpengaruh.",
            "Saya sempat mencoba {alt} lebih dulu. Hasilnya tidak sesuai [harapan|dugaan], sehingga saya menelusuri lagi bagian {c1}.",
            "Menurut saya penjelasan di modul agak menyederhanakan, karena tidak [membahas|menyinggung] {c3} sama sekali.",
            "Kalau {c1} diabaikan, akibatnya hasil akhirnya bisa salah walaupun di awal [terlihat|kelihatan] baik-baik saja.",
            "Kelemahan pilihan saya ada di {c2}, dan [itu|menurut saya itu] harga yang masih masuk akal.",
            "Sejauh ini saya menilai {pick} lebih tepat, tetapi belum tentu begitu untuk kasus yang jauh lebih besar.",
            "Saya membandingkan kedua pendekatan dengan contoh kecil, lalu memeriksa langkah mana yang paling berpengaruh.",
            "Perbedaan paling terasa justru ada di {c0}, bukan di bagian yang saya duga [sebelumnya|di awal].",
        ],
        "close": [
            "Mungkin masih ada yang kurang tepat, tapi itu yang bisa saya simpulkan sejauh ini.",
            "Bagian yang masih ingin saya tanyakan di pertemuan berikutnya adalah {c3}.",
            "Saya belum [yakin|sepenuhnya yakin], jadi masih perlu dicoba lagi dengan contoh lain.",
            "Kesimpulan saya sementara: {pick} cukup, asal {c1} diperhatikan sejak awal.",
        ],
    },
    M: {
        "open": [
            "{Topic} merupakan materi yang membahas {c0} dan {c1}.",
            "Pada tugas ini saya menjelaskan {topic} beserta penerapannya.",
            "Tugas ini membahas {topic} dengan contoh {ex}.",
            "Materi {topic} berkaitan erat dengan {c0}.",
        ],
        "shallow": [
            "Pertama, {c0} perlu dipahami terlebih dahulu.",
            "Kemudian {c1} digunakan untuk menentukan langkah berikutnya.",
            "Setelah itu, {c2} diperhatikan agar hasilnya sesuai tujuan.",
            "Contohnya dapat dilihat pada {ex}.",
            "Tahap ini memainkan peran penting dalam keseluruhan proses.",
            "Dengan mengikuti urutan tersebut, hasil yang diperoleh menjadi lebih mudah diperiksa kembali.",
            "Saya menerapkan langkah yang sama ketika mengerjakan latihan sebelumnya.",
            "Selain itu, {c3} juga perlu diperhatikan.",
        ],
        "deep": [
            "Namun apabila dibandingkan dengan {alt}, {pick} lebih sesuai karena {why}.",
            "Perlu dicatat, {c3} dapat mengubah hasil apabila kondisinya berbeda.",
            "Oleh karena itu, pemilihan pendekatan perlu mempertimbangkan konteksnya masing-masing.",
            "Kelebihannya terletak pada {c0}, sedangkan kekurangannya ada pada {c2}.",
            "Pada percobaan saya, {alt} memberikan hasil yang kurang stabil.",
            "Menurut saya {pick} lebih tepat untuk {ex}, meskipun tidak selalu berlaku di kasus lain.",
            "Hasil itu sesuai dengan penjelasan di kelas tentang {c1}.",
        ],
        "close": [
            "Kesimpulannya, {topic} perlu dipahami secara bertahap sesuai konteks penerapannya.",
            "Dengan demikian, {pick} dapat menjadi pilihan yang baik untuk kasus serupa.",
        ],
    },
    H: {
        "open": [
            "Di era digital ini, {topic} tidak dapat dipungkiri memainkan peran penting.",
            "Secara fundamental, {topic} dapat dikonseptualisasikan sebagai kerangka yang saling terhubung.",
            "Dalam lanskap yang terus berkembang, {topic} menjadi sorotan utama yang sangat penting.",
            "Seiring berjalannya waktu, {topic} menjadi aspek krusial yang sangat penting untuk dipahami.",
        ],
        "shallow": [
            "Terdapat beberapa komponen utama yang perlu dicatat, yaitu {c0}, {c1}, dan {c2}.",
            "Masing-masing komponen tersebut memiliki karakteristik dan fungsi yang saling melengkapi.",
            "Selain itu, {c3} merupakan aspek penting yang tidak dapat dipungkiri keberadaannya.",
            "Secara holistik, seluruh komponen tersebut memainkan peran penting dalam keberhasilan sistem.",
            "Perlu dicatat bahwa pemahaman yang komprehensif sangat penting untuk diterapkan secara optimal.",
            "Di tengah dinamika kebutuhan saat ini, struktur tersebut menjadi semakin kompleks.",
            "Hal ini membuka jalan bagi penerapan yang lebih efektif, efisien, dan berkelanjutan.",
        ],
        "deep": [
            "Apabila dibandingkan dengan {alt}, {pick} menawarkan keunggulan signifikan karena {why}.",
            "Kelebihan utamanya terletak pada {c0}, sementara kekurangannya terletak pada {c2}.",
            "Analisis komparatif memperlihatkan bahwa {c1} memainkan peran penting terhadap hasil akhir.",
            "Oleh karena itu, pemilihan pendekatan seharusnya mempertimbangkan {c3} secara holistik.",
            "Evaluasi terhadap kedua pendekatan menunjukkan bahwa {pick} lebih efektif untuk {ex}.",
            "Perlu dicatat bahwa implikasi tersebut berlaku pada berbagai konteks penerapan serupa.",
            "Dengan mempertimbangkan seluruh aspek tersebut, {pick} dinilai lebih unggul secara keseluruhan.",
            "Tidak dapat dipungkiri, pendekatan ini membuka jalan bagi solusi yang lebih optimal.",
            "Secara fundamental, keputusan tersebut sangat penting untuk menjaga kualitas hasil akhir.",
        ],
        "close": [
            "Dengan demikian, {topic} memiliki peran strategis yang perlu dipahami secara komprehensif.",
            "Kesimpulannya, pendekatan yang tepat akan menghasilkan solusi yang optimal dan berkelanjutan.",
        ],
    },
}

# Kalimat per bagian menurut kedalaman: (dangkal, penalaran).
_SHAPE = {0: (5, 0), 1: (3, 4), 2: (2, 9)}

_LEAK_TAILS = (
    "Semoga penjelasan ini membantu! Jika Anda ingin, saya dapat menguraikan bagian tertentu lebih rinci.",
    "Jika Anda ingin mendalami salah satu poin di atas, beri tahu saya.",
)

_ALT = re.compile(r"\[([^\[\]]+)\]")

# Padanan kata yang dipilih acak di setiap kemunculan. Dua mahasiswa yang kebetulan memakai pola
# kalimat sama tetap menulis kata berbeda, seperti di kelas sungguhan. Padanan konektor sengaja
# sejenis (sebab-akibat tetap sebab-akibat), jadi taksiran level Bloom tidak berubah.
_SYNONYMS = {
    "tetapi": ("tetapi", "namun", "tapi"),
    "karena": ("karena", "sebab"),
    "bisa": ("bisa", "dapat"),
    "dapat": ("dapat", "bisa"),
    "kalau": ("kalau", "jika", "apabila"),
    "apabila": ("apabila", "jika", "bila"),
    "dan": ("dan", "dan", "serta"),
    "ketika": ("ketika", "saat"),
    "lalu": ("lalu", "kemudian", "setelah itu"),
    "kemudian": ("kemudian", "lalu", "selanjutnya"),
    "sudah": ("sudah", "telah"),
    "hanya": ("hanya", "sekadar", "cuma"),
    "agar": ("agar", "supaya"),
    "supaya": ("supaya", "agar"),
    "sempat": ("sempat", "pernah"),
    "mencoba": ("mencoba", "menjajal"),
    "agak": ("agak", "sedikit"),
    "sangat": ("sangat", "amat"),
    "bagian": ("bagian", "poin"),
    "menunjukkan": ("menunjukkan", "memperlihatkan"),
    "memperlihatkan": ("memperlihatkan", "menunjukkan"),
    "pendekatan": ("pendekatan", "metode", "cara"),
    "komponen": ("komponen", "unsur", "elemen"),
    "aspek": ("aspek", "dimensi"),
    "komprehensif": ("komprehensif", "menyeluruh"),
    "optimal": ("optimal", "maksimal"),
    "penting": ("penting", "krusial", "esensial"),
    "signifikan": ("signifikan", "substansial"),
    "berbagai": ("berbagai", "beragam", "aneka"),
    "masing-masing": ("masing-masing", "setiap"),
    "perlu": ("perlu", "harus", "mesti"),
    "lebih": ("lebih", "jauh lebih"),
    "membuat": ("membuat", "menjadikan"),
    "mudah": ("mudah", "gampang", "sederhana"),
    "jelas": ("jelas", "terang", "gamblang"),
    "kasus": ("kasus", "persoalan", "situasi"),
    "diperhatikan": ("diperhatikan", "dicermati", "dijaga"),
}
_WORD = re.compile(r"[A-Za-z-]+")


def _vary(rng: random.Random, text: str) -> str:
    """Ganti kata umum dengan padanannya, satu pilihan acak per kemunculan."""

    def swap(match: re.Match) -> str:
        word = match.group(0)
        options = _SYNONYMS.get(word.lower())
        if not options:
            return word
        pick = rng.choice(options)
        return pick[0].upper() + pick[1:] if word[0].isupper() else pick

    return _WORD.sub(swap, text)
_NAMES = {
    "fn": ("hitung", "proses", "solusi", "cek", "jalankan"),
    "arr": ("data", "nilai", "daftar", "items", "angka"),
    "x": ("v", "item", "n", "harga", "elemen"),
}


def depth_for(trajectory: str, step: int, total: int, rng: random.Random) -> int:
    """Kedalaman jawaban pada tugas ke-`step` (0-based) dari `total`."""
    progress = step / max(total - 1, 1)
    base = {
        "kuat": 2,
        "sedang": 1,
        "lemah": 0,
        "naik": 0 if progress < 0.34 else 1 if progress < 0.67 else 2,
        "turun": 2 if progress < 0.34 else 1 if progress < 0.67 else 0,
    }[trajectory]
    # Sesekali satu tingkat lebih baik atau lebih buruk: tidak ada mahasiswa yang konsisten sempurna.
    if rng.random() < 0.2:
        base += rng.choice((-1, 1))
    return max(0, min(2, base))


def _fill(rng: random.Random, frame: str, slots: dict) -> str:
    text = _ALT.sub(lambda m: rng.choice(m.group(1).split("|")), frame)
    # Padanan diterapkan sebelum slot diisi, jadi istilah teknis di slot tidak ikut berubah.
    return _vary(rng, text).format(**slots)


def _slot_values(slots: dict) -> dict:
    c = slots["c"]
    return {
        "topic": slots["topic"],
        "Topic": slots["topic"][0].upper() + slots["topic"][1:],
        "c0": c[0], "c1": c[1], "c2": c[2], "c3": c[3],
        "ex": slots["ex"],
        "pick": slots["pick"],
        "alt": slots["alt"],
        "Alt": slots["alt"][0].upper() + slots["alt"][1:],
        "why": slots["why"],
    }


def compose(rng: random.Random, persona: Persona, depth: int, slots: dict) -> list[str]:
    """Paragraf jawaban (teks polos), 2 sampai 3 paragraf."""
    pool = _POOLS[persona.band]
    values = _slot_values(slots)
    n_shallow, n_deep = _SHAPE[depth]
    sentences = [_fill(rng, rng.choice(pool["open"]), values)]
    sentences += [_fill(rng, f, values) for f in rng.sample(pool["shallow"], n_shallow)]
    sentences += [_fill(rng, f, values) for f in rng.sample(pool["deep"], min(n_deep, len(pool["deep"])))]
    sentences.append(_fill(rng, rng.choice(pool["close"]), values))

    cut = 1 + n_shallow
    paragraphs = [" ".join(sentences[:cut])]
    if n_deep:
        paragraphs.append(" ".join(sentences[cut:-1]))
        paragraphs.append(sentences[-1])
    else:
        paragraphs[0] += " " + sentences[-1]
    if persona.band == H and rng.random() < persona.leaky:
        c = slots["c"]
        paragraphs.insert(1, "\n".join(f"• {item[0].upper() + item[1:]}" for item in c[:3]))
        paragraphs.append(rng.choice(_LEAK_TAILS))
    return paragraphs


def code_for(rng: random.Random, template: str) -> str:
    return template.format(**{key: rng.choice(options) for key, options in _NAMES.items()})


def nim_for(index: int) -> str:
    """NIM bergaya BINUS: angkatan 2702, lalu enam digit tetap per mahasiswa."""
    return f"2702{random.Random(index).randint(100000, 999999)}"
