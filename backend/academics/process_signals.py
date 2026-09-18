"""E1 sinyal 4: forensik proses pengerjaan.

Ini sinyal terkuat yang dimiliki ThinkPath, dan satu satunya dari empat sinyal
blueprint yang datanya sudah tersedia penuh tanpa model, dataset, atau GPU.
Alasannya: sinyal ini tidak membaca teks sama sekali. Parafrase, humanizer, dan
penulisan ulang tidak mengubah fakta bahwa 412 kata muncul dalam 4 menit lewat
satu lonjakan tanpa pengetikan bertahap.

Yang TIDAK diskor di sini, dan itu disengaja:

Jam pengumpulan. Mengumpulkan pukul 02.37 memang layak dilaporkan ke dosen, tetapi
sebagai pembeda ia buruk. Mahasiswa rajin yang begadang dan mahasiswa yang menyalin akan
terlihat sama. Menghukum jam pengerjaan juga menghukum mahasiswa yang hanya punya
waktu malam hari. Jam tetap ditampilkan di layar dosen, tetapi tidak menambah
skor.

Jumlah revisi. Yang tersedia hanya berapa kali tombol Simpan Revisi ditekan
SETELAH jawaban dikumpulkan, bukan penyuntingan saat menulis. Submit pertama
selalu bernilai nol revisi, sehingga ketika revisi masih diskor, setiap jawaban
sepanjang 100 kata ke atas otomatis mendapat +7,5 poin skor AI, dan esai yang
sama bisa pindah band hanya karena tombol yang ditekan. Jumlah revisi tetap
ditulis di bukti untuk dosen, sama seperti jam: ditampilkan, tidak diskor.

Jam dinding juga tidak dirakit di modul ini. Backend berjalan pada TIME_ZONE UTC
sedangkan frontend merender waktu ke zona lokal pembaca, sehingga jam yang
ditanam di string dari sini akan berbeda dengan jam di layar. Modul ini hanya
menghasilkan besaran yang bebas zona waktu: durasi, laju, revisi, dan tempelan.
"""
from __future__ import annotations

from dataclasses import dataclass

# Laju mengarang berkelanjutan untuk mahasiswa. Di bawah batas bawah dianggap wajar,
# di atas batas atas praktis mustahil untuk teks yang disusun sendiri.
PLAUSIBLE_WPM = 25.0
IMPLAUSIBLE_WPM = 80.0

# Bobot antar sub-indikator di dalam sinyal proses, jumlahnya 1,0. "pace"
# diisi laju mengetik, atau bentuk kurva pertumbuhan kata bila jejaknya terekam.
# Perbandingan 0,45 : 0,25 dipertahankan dari bobot lama setelah revisi (0,30)
# dikeluarkan dari skor; alasannya ada di docstring modul.
SUB_WEIGHTS = {"pace": 0.45 / 0.70, "paste": 0.25 / 0.70}


# Lonjakan sebesar ini dalam satu selang cuplikan tidak mungkin diketik.
# Pada selang 30 detik, 60 kata setara 120 kata per menit berkelanjutan.
BURST_WORDS = 60

# Di bawah jumlah cuplikan ini deretnya terlalu pendek untuk dibaca sebagai
# pola. Mahasiswa yang membuka form lalu langsung mengumpulkan memang tidak
# meninggalkan jejak, dan itu bukan bukti apa apa.
MIN_SAMPLES = 4


@dataclass(frozen=True)
class ProgressSample:
    """Jumlah kata pada satu titik waktu selama pengerjaan."""

    offset_seconds: int
    word_count: int


@dataclass(frozen=True)
class ProcessContext:
    """Metadata pengerjaan satu submission. Tidak memuat teks jawaban."""

    duration_seconds: int | None
    revision_count: int
    word_count: int
    char_count: int
    paste_char_count: int = 0
    # Kosong berarti tidak terekam, bukan berarti mencurigakan.
    progress: tuple[ProgressSample, ...] = ()
    # False bila form yang dipakai belum merekam tempelan, misalnya submission
    # lama. Nol karakter ditempel baru berarti "tidak menempel" kalau memang
    # direkam; tanpa pembeda ini, bukti "tidak ada tempelan" tertulis untuk
    # jawaban yang tempelannya tidak pernah diamati.
    paste_recorded: bool = True

    @property
    def words_per_minute(self) -> float | None:
        if not self.duration_seconds or self.duration_seconds <= 0:
            return None
        return round(self.word_count / (self.duration_seconds / 60.0), 1)

    @property
    def has_progress(self) -> bool:
        return len(self.progress) >= MIN_SAMPLES


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _pace_value(context: ProcessContext) -> tuple[float, str]:
    wpm = context.words_per_minute
    if wpm is None:
        return 0.5, "Durasi pengerjaan tidak terekam"
    if wpm <= PLAUSIBLE_WPM:
        value = 0.0
    else:
        span = IMPLAUSIBLE_WPM - PLAUSIBLE_WPM
        value = _clamp01((wpm - PLAUSIBLE_WPM) / span)
    minutes = max(1, round((context.duration_seconds or 0) / 60))
    return value, f"{context.word_count} kata dalam {minutes} menit ({wpm:.0f} kata/menit)"


def _revision_note(context: ProcessContext) -> str:
    """Keterangan revisi untuk dosen. Tidak pernah menyumbang nilai."""
    if context.revision_count <= 0:
        return ""
    return f"direvisi {context.revision_count} kali setelah dikumpulkan (tidak diskor)"


def _paste_value(context: ProcessContext) -> tuple[float, str]:
    if not context.paste_recorded:
        return 0.0, "Tempelan tidak terekam pada pengerjaan ini"
    if context.paste_char_count <= 0:
        return 0.0, "Tidak ada teks yang ditempel"
    if context.char_count <= 0:
        return 0.5, "Ada tempelan, panjang teks akhir tidak diketahui"
    ratio = context.paste_char_count / context.char_count
    return (
        _clamp01(ratio / 0.5),
        f"{context.paste_char_count} karakter ditempel "
        f"({ratio * 100:.0f}% dari teks akhir)",
    )


# Di atas porsi tempelan ini, laju mengetik berhenti mengukur apa pun.
PASTE_DOMINATES_RATIO = 0.5


def _growth_value(context: ProcessContext) -> tuple[float, str]:
    """Bentuk kurva pertumbuhan kata, bukan sekadar berapa lama duduk.

    Ini satu satunya sub-indikator yang tidak bisa dikalahkan dengan menunggu.
    Menempel lalu diam menghasilkan satu lonjakan tegak diikuti garis datar;
    menulis sungguhan menghasilkan tanjakan bertahap. Dua bentuk yang mustahil
    tertukar, berapa lama pun jendelanya dibiarkan terbuka.

    Yang diukur porsi teks akhir yang tiba lewat lonjakan, dijumlahkan dari
    SELURUH selang yang melonjak, bukan hanya yang terbesar. Mengambil yang
    terbesar saja membuka siasat memecah tempelan menjadi beberapa potong:
    empat tempelan seratus kata masing masing terlihat kecil terhadap jawaban
    empat ratus kata, padahal tidak satu pun diketik.
    """
    if not context.has_progress:
        return 0.5, "Jejak pengerjaan tidak terekam"

    samples = sorted(context.progress, key=lambda s: s.offset_seconds)
    burst_total = 0
    burst_count = 0
    largest = 0

    # Cuplikan pertama diperlakukan sebagai lonjakan dari nol. Kata yang sudah
    # ada sebelum pengamatan pertama tidak pernah terlihat diketik, dan tanpa
    # aturan ini menempel sebelum cuplikan perdana menghasilkan garis datar
    # sejak awal yang justru terbaca paling wajar. Jawaban yang benar benar
    # ditulis di sini dimulai dari nol atau mendekatinya.
    deltas = [samples[0].word_count] + [
        after.word_count - before.word_count
        for before, after in zip(samples, samples[1:])
    ]
    for delta in deltas:
        largest = max(largest, delta)
        if delta >= BURST_WORDS:
            burst_total += delta
            burst_count += 1

    final = max(samples[-1].word_count, 1)
    share = _clamp01(burst_total / final)

    if burst_count == 0:
        return (
            0.0,
            f"Teks tumbuh bertahap, penambahan terbesar {largest} kata sekaligus",
        )

    potongan = "satu lonjakan" if burst_count == 1 else f"{burst_count} lonjakan"
    return (
        share,
        f"{burst_total} kata muncul lewat {potongan} tanpa pengetikan bertahap "
        f"({share * 100:.0f}% dari jawaban akhir)",
    )


def _paste_ratio(context: ProcessContext) -> float:
    # Tempelan yang tidak terekam tidak boleh memicu cabang "didominasi
    # tempelan". Satu sesi revisi dari form lama bisa mematikan penandanya
    # sementara karakter tempelan sesi pertama masih tersimpan, dan hasilnya
    # dulu bukti yang bertentangan: "didominasi tempelan" berdampingan dengan
    # "tempelan tidak terekam".
    if not context.paste_recorded:
        return 0.0
    if context.paste_char_count <= 0 or context.char_count <= 0:
        return 0.0
    return _clamp01(context.paste_char_count / context.char_count)


def evaluate_process(context: ProcessContext) -> tuple[float, str]:
    """Nilai 0 sampai 1 untuk sinyal proses, beserta ringkasan buktinya.

    Laju mengetik berhenti dinilai ketika sebagian besar teks akhir berasal dari
    tempelan. Alasannya sederhana: mahasiswa yang menempel tidak mengetik apa
    pun, jadi "kata per menit" hanya membagi teks orang lain dengan lama ia
    duduk. Laju yang tampak wajar pada teks tempelan akan menyeret turun bukti
    terkuat yang bisa dikumpulkan sistem ini.

    Bobot laju tidak dibuang melainkan dialihkan ke tempelan, sehingga totalnya
    tetap 1,0 dan tidak ada sub-indikator yang diam diam berubah arti.

    Menghitung laju hanya dari bagian yang tidak ditempel sempat dipertimbangkan
    dan ditolak: pada tempelan seratus persen hasilnya nol kata per menit, yang
    justru terbaca paling wajar dari semua kemungkinan.

    Ketika jejak pertumbuhan kata terekam, ia menggantikan laju sepenuhnya.
    Keduanya menjawab pertanyaan yang sama, yaitu apakah teks ini benar benar
    disusun di sini, tetapi laju agregat kalah oleh satu siasat sederhana:
    menempel lalu membiarkan jendela terbuka sampai durasinya terlihat wajar.
    Bentuk kurva tidak bisa dikalahkan begitu, karena menunggu justru
    memperpanjang garis datarnya.
    """
    paste, paste_text = _paste_value(context)

    if context.has_progress:
        first, first_text = _growth_value(context)
    else:
        first, first_text = _pace_value(context)

    if _paste_ratio(context) >= PASTE_DOMINATES_RATIO:
        value = paste
        first_text = f"{first_text}, tidak dinilai karena teks didominasi tempelan"
    else:
        value = first * SUB_WEIGHTS["pace"] + paste * SUB_WEIGHTS["paste"]

    parts = [first_text, paste_text.lower(), _revision_note(context)]
    return _clamp01(value), ", ".join(part for part in parts if part)
