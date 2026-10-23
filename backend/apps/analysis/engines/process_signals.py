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

Tindakan menempel. Mahasiswa wajar menempel kutipan, definisi, atau data dari
artikel yang ia rujuk, jadi menempel sendiri bukan tanda apa pun dan hanya
menambah bising. Form tidak merekamnya, dan skor tidak membacanya. Yang tetap
dibaca adalah bentuk kurva pertumbuhan kata: seluruh jawaban yang muncul dalam
satu lonjakan lalu datar tetap terlihat, tetapi sumbangannya sebanding dengan
porsinya, sehingga satu kutipan pendek di tengah esai hanya bergeser sedikit.

Sinyal ini TIDAK menjumlah ke skor AI (lihat PROCESS_WEIGHT di ai_score.py).
Ia dilaporkan terpisah sebagai "pola pengerjaan" (assess_process). Alasannya
terukur: ambang skor AI diukur pada teks saja; tidak ada data berlabel untuk
bobot proses; dan mahasiswa yang menulis di Word lalu menempel menghasilkan
lonjakan yang sama dengan penyalin tanpa menjadi penyalin. Dosen yang membaca
dua bukti terpisah bisa menimbang konteksnya sendiri.

Jam dinding juga tidak dirakit di modul ini. Backend berjalan pada TIME_ZONE UTC
sedangkan frontend merender waktu ke zona lokal pembaca, sehingga jam yang
ditanam di string dari sini akan berbeda dengan jam di layar. Modul ini hanya
menghasilkan besaran yang bebas zona waktu: durasi, laju, dan jumlah kata.
"""
from __future__ import annotations

from dataclasses import dataclass

# Laju mengarang berkelanjutan untuk mahasiswa. Di bawah batas bawah dianggap wajar,
# di atas batas atas praktis mustahil untuk teks yang disusun sendiri.
PLAUSIBLE_WPM = 25.0
IMPLAUSIBLE_WPM = 80.0


# Lonjakan = sedikitnya BURST_WORDS kata yang tiba dengan laju minimal BURST_WPM
# antar dua cuplikan. Dua syarat, bukan satu: cuplikan sekarang dicatat server
# pada jarak tidak tetap, dan 60 kata dalam 5 menit (12 kata/menit) bukan
# lonjakan sama sekali. 120 kata/menit berkelanjutan lewat dari kecepatan
# mengetik mengarang mana pun.
BURST_WORDS = 60
BURST_WPM = 120.0

# Porsi jawaban akhir yang tiba lewat lonjakan: di bawah NORMAL_SHARE dianggap
# wajar (kutipan pendek), di atas ATTENTION_SHARE layak dilihat dosen.
NORMAL_SHARE = 0.35
ATTENTION_SHARE = 0.6

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
    # Kosong berarti tidak terekam, bukan berarti mencurigakan.
    progress: tuple[ProgressSample, ...] = ()
    # Kata baru (tidak ada di teks sebelumnya) yang masuk lewat revisi. Tanpa
    # ini, jawaban asli yang diketik lalu diganti seluruhnya saat revisi masih
    # tampak sebagai kurva yang wajar.
    inserted_words: int = 0

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
    if context.duration_seconds == 0 and context.word_count >= BURST_WORDS:
        # Nol yang TERUKUR (server tidak pernah melihat teks ini ditulis), bukan
        # durasi yang tidak diketahui: seluruh teks tiba saat dikumpulkan.
        return 1.0, f"{context.word_count} kata tiba sekaligus saat dikumpulkan, tanpa penulisan di editor ThinkPath"
    wpm = context.words_per_minute
    if wpm is None:
        return 0.5, "Durasi pengerjaan tidak terekam"
    if context.word_count < BURST_WORDS:
        # Jawaban pendek diketik dalam hitungan detik tanpa mencurigakan; laju
        # agregat baru bermakna bila ada cukup kata untuk disebut lonjakan.
        return 0.0, f"{context.word_count} kata, terlalu pendek untuk menilai laju mengetik"
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
    # Pasangan (selisih kata, detik antar cuplikan). Detik minimal 1 agar dua
    # cuplikan di detik yang sama tidak membagi dengan nol.
    steps = [(samples[0].word_count, max(samples[0].offset_seconds, 1))] + [
        (after.word_count - before.word_count, max(after.offset_seconds - before.offset_seconds, 1))
        for before, after in zip(samples, samples[1:])
    ]
    for delta, seconds in steps:
        largest = max(largest, delta)
        if delta >= BURST_WORDS and delta / seconds * 60.0 >= BURST_WPM:
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


def evaluate_process(context: ProcessContext) -> tuple[float, str]:
    """Nilai 0 sampai 1 untuk sinyal proses, beserta ringkasan buktinya.

    Satu sub-indikator saja: bentuk kurva pertumbuhan kata bila jejaknya
    terekam, atau laju mengetik agregat bila tidak. Keduanya menjawab pertanyaan
    yang sama, yaitu apakah teks ini benar benar disusun di sini. Laju agregat
    kalah oleh satu siasat sederhana, menempel lalu membiarkan jendela terbuka
    sampai durasinya terlihat wajar; bentuk kurva tidak, karena menunggu justru
    memperpanjang garis datarnya. Karena itu kurva menggantikan laju sepenuhnya
    begitu tersedia.

    Kata yang masuk lewat revisi dihitung sebagai lonjakan tersendiri: menukar
    seluruh isi jawaban saat "Simpan Revisi" tidak boleh lolos hanya karena
    kurva pengerjaan aslinya wajar.

    Jumlah revisi hanya ditulis sebagai keterangan, dan tindakan menempel tidak
    dibaca sama sekali. Alasan keduanya ada di docstring modul.
    """
    if context.has_progress:
        value, evidence = _growth_value(context)
    else:
        value, evidence = _pace_value(context)

    if context.inserted_words >= BURST_WORDS:
        share = _clamp01(context.inserted_words / max(context.word_count, 1))
        if share > value:
            value = share
        evidence += f", {context.inserted_words} kata baru masuk sekaligus lewat revisi"

    parts = [evidence, _revision_note(context)]
    return _clamp01(value), ", ".join(part for part in parts if part)


class ProcessBand:
    """Pita pola pengerjaan. Netral: bukan vonis, tidak menyebut AI."""

    NORMAL = "normal"
    PARTIAL = "partial"
    ATTENTION = "attention"
    UNRECORDED = "unrecorded"
    # Jawaban diimpor dari dokumen: tidak ada jejak mengetik yang bisa dinilai.
    NOT_APPLICABLE = ""


@dataclass(frozen=True)
class ProcessAssessment:
    band: str
    value: float
    evidence: str


def assess_process(context: ProcessContext | None) -> ProcessAssessment:
    """Pola pengerjaan sebagai bukti tersendiri, terpisah dari skor AI.

    "unrecorded" hanya bila server benar-benar tidak punya dasar menilai
    (durasi tidak diketahui dan jejak tak cukup). Durasi nol yang terukur
    dengan teks panjang adalah bukti, bukan ketiadaan bukti.
    """
    if context is None:
        return ProcessAssessment(ProcessBand.NOT_APPLICABLE, 0.0, "")
    value, evidence = evaluate_process(context)
    if not context.has_progress and context.duration_seconds is None:
        return ProcessAssessment(ProcessBand.UNRECORDED, value, evidence)
    if not context.has_progress and context.words_per_minute is None and value == 0.5:
        return ProcessAssessment(ProcessBand.UNRECORDED, value, evidence)
    if value >= ATTENTION_SHARE:
        band = ProcessBand.ATTENTION
    elif value >= NORMAL_SHARE:
        band = ProcessBand.PARTIAL
    else:
        band = ProcessBand.NORMAL
    return ProcessAssessment(band, value, evidence)
