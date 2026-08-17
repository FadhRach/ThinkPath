"""Detektor AI eksternal, dipakai untuk skor E1 saja.

Penyedia sekarang: **Winston AI**. Nama modul ini sengaja generik, bukan
`winston.py`, karena penyedia sudah terbukti bisa gugur. Integrasi pertama
memakai Sapling dan dibatalkan setelah ketahuan detektornya English-only,
padahal produk ini menilai esai berbahasa Indonesia. Pemanggil hanya tahu
`detect()`, jadi pindah penyedia berikutnya cukup mengganti isi berkas ini.

Kenapa detektor eksternal dipakai sama sekali. Heuristik di ai_score.py sudah
diukur terhadap gold set 921 sampel dan hasilnya lemah: pada ambang produksi 35
presisinya 0,498 dengan FPR 0,838, artinya 84 persen tulisan manusia ikut
tertuduh dan tebakan koin sama bagusnya. Tiga dari lima sinyal teksnya diam
sepanjang pengukuran itu. Detail lengkapnya ada di bagian "Status kalibrasi"
pada README.

Yang TIDAK berubah karena modul ini ada:

- Sinyal forensik proses tetap dipakai dan tetap berbobot 0,25. Detektor mana
  pun membaca teks, dan apa pun yang membaca teks bisa dikalahkan parafrase.
  Forensik proses tidak membaca teks sama sekali.
- Level Bloom tidak pernah menyentuh modul ini, dan modul ini tidak pernah
  menyentuh level Bloom. Dijaga pemeriksaan AST di test_analysis_decoupling.py.

PERINGATAN KEJUJURAN. Winston mencantumkan `id` di daftar bahasa API-nya, tetapi
itu klaim penyedia, bukan hasil ukur kita. Sampai
ai_experiment/src/evaluate_detector.py memberi angka pada gold set berbahasa
Indonesia, tidak boleh ada klaim bahwa Winston lebih akurat daripada heuristik.
Yang boleh dikatakan sekarang hanya: skornya berasal dari detektor yang memang
dilatih untuk tugas ini dan mengaku mendukung bahasanya.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import requests

from .models import AiBand

logger = logging.getLogger(__name__)

PROVIDER_NAME = "Winston AI"
API_URL = "https://api.gowinston.ai/v2/ai-content-detection"

# Versi model dikunci eksplisit, bukan dibiarkan mengikuti default penyedia.
# Skor yang tersimpan di database hari ini harus masih bisa dijelaskan enam
# bulan lagi. Menggesernya adalah keputusan sadar yang menuntut kalibrasi ulang,
# bukan sesuatu yang terjadi diam diam pada suatu Selasa pagi.
MODEL_VERSION = "4.18"

# Bahasa yang diminta secara eksplisit. Winston bisa mendeteksi sendiri kalau
# field ini dikosongkan, tetapi jawaban mahasiswa Indonesia sering mencampur
# istilah Inggris, dan deteksi otomatis pada teks campuran bisa memilih "en"
# lalu menilainya dengan model yang salah.
LANGUAGE = "id"

# Sengaja lebih pendek daripada timeout Groq (12 detik) di llm.py. Analisis
# jalan sinkron di dalam request pengumpulan tugas, dan sejak modul ini ada
# kedua API dipanggil berurutan. 8 + 12 = 20 detik masih jauh di bawah timeout
# gunicorn 60 detik, sehingga worker tidak pernah dibunuh di tengah jalan.
REQUEST_TIMEOUT_SECONDS = 8

# Batas keras dari Winston. Teks di bawah ini ditolak API, jadi tidak usah
# dikirim: kredit terpakai per kata dan permintaan yang pasti gagal tetap
# menghabiskan waktu request mahasiswa.
MIN_CHARS = 300

# Winston menyatakan sendiri hasilnya belum andal di bawah ambang ini. Teksnya
# tetap dinilai, tetapi hasilnya ditandai tidak andal supaya pemanggil bisa
# menurunkan keyakinan. Membuang diam diam akan menghilangkan bukti, sedangkan
# memakainya seolah andal akan menuduh dengan dasar yang penyedianya sendiri
# tidak percayai.
RELIABLE_MIN_CHARS = 600

MAX_CHARS = 150_000

# Ambang band MILIK DETEKTOR EKSTERNAL SENDIRI.
#
# Jangan pernah memakai ambang 35/70 dari ai_score.py di sini. Angka itu
# dikalibrasi (dengan buruk) untuk sebaran skor ensemble heuristik, dan sebaran
# skor detektor terlatih sama sekali berbeda bentuknya. Menyalin ambang antar
# dua sebaran yang berbeda adalah persis kesalahan yang diperingatkan di README:
# ambang pinjaman terdengar masuk akal dan menyesatkan tanpa suara.
#
# Kedua angka di bawah adalah TITIK AWAL SEMENTARA, bukan hasil ukur. Ganti
# dengan keluaran ai_experiment/src/evaluate_detector.py sebelum mengklaim apa
# pun tentang presisi atau recall.
MID_THRESHOLD = 35
HIGH_THRESHOLD = 70


@dataclass(frozen=True)
class DetectorResult:
    """Hasil satu penilaian detektor eksternal.

    ai_probability sudah DIBALIK dari skor mentah penyedia. Winston
    mengembalikan "human score" yang arahnya berlawanan: 0 berarti hampir pasti
    AI, 100 berarti hampir pasti manusia. Pembalikannya dikerjakan satu kali di
    sini supaya sisa sistem tidak perlu mengingat arah mana yang berlaku untuk
    penyedia mana. Salah arah di lapisan ini akan membuat mahasiswa yang menulis
    sendiri mendapat skor tertinggi, dan angkanya akan terlihat masuk akal
    sehingga kesalahannya bisa berjalan lama tanpa ketahuan.
    """

    ai_probability: float
    reliable: bool
    attack_kinds: tuple[str, ...] = ()

    @property
    def attack_detected(self) -> bool:
        return bool(self.attack_kinds)


def score_to_band(ai_score: int) -> str:
    """Petakan skor 0..100 hasil detektor ke band.

    Fungsi terpisah dari ai_score.score_to_band walaupun isinya sekarang
    kebetulan sama. Keduanya harus bisa bergerak sendiri sendiri begitu
    kalibrasi memberi angka, dan menyatukannya sekarang berarti menggeser satu
    ambang akan diam diam menggeser ambang yang lain.
    """
    if ai_score < MID_THRESHOLD:
        return AiBand.LOW
    if ai_score < HIGH_THRESHOLD:
        return AiBand.MID
    return AiBand.HIGH


def is_enabled() -> bool:
    return bool(os.getenv("WINSTON_API_KEY", "").strip())


def _attack_kinds(payload: dict) -> tuple[str, ...]:
    """Penanda pengelabuan yang dilaporkan Winston.

    Zero width space dan homoglyph adalah teknik menyisipkan karakter tak
    terlihat atau huruf mirip untuk mengacaukan detektor. Berbeda dari sinyal
    gaya bahasa, keduanya tidak punya penjelasan polos: tidak ada mahasiswa yang
    tanpa sengaja menempelkan karakter lebar nol ke dalam esainya.

    Tetap dilaporkan sebagai bukti tertulis, bukan sebagai tambahan diam diam
    ke angka. Menaikkan skor tanpa mengatakan alasannya persis yang produk ini
    tolak.
    """
    attack = payload.get("attack_detected")
    if not isinstance(attack, dict):
        return ()
    labels = {
        "zero_width_space": "penyisipan karakter lebar nol",
        "homoglyph_attack": "penggantian huruf dengan karakter mirip",
    }
    return tuple(label for key, label in labels.items() if attack.get(key))


# Sisa kredit yang membuat peringatan mulai dicetak. Satu kredit terpakai per
# kata, jadi angka ini kira kira lima esai mahasiswa: cukup untuk menyadari dan
# mengisi saldo, belum terlambat.
LOW_CREDIT_WARNING = 2_000


def _warn_if_credits_low(payload: dict) -> None:
    """Peringatkan sebelum kredit habis, bukan sesudahnya.

    Penyedia mengirim sisa kredit di setiap balasan. Tanpa membacanya, satu
    satunya tanda bahwa saldo habis adalah 402 yang muncul mendadak, dan sejak
    itu setiap submission diam diam turun ke jalur cadangan tanpa ada yang
    menyadarinya sampai seseorang kebetulan memeriksa log. Kejadian itu sudah
    pernah terjadi, dan peringatan ini yang membuatnya tidak berulang diam diam.
    """
    remaining = payload.get("credits_remaining")
    if not isinstance(remaining, (int, float)):
        return
    if remaining <= LOW_CREDIT_WARNING:
        logger.warning(
            "Kredit %s tinggal %s. Satu kredit terpakai per kata, jadi ini "
            "hanya beberapa esai lagi sebelum skor AI turun ke jalur cadangan.",
            PROVIDER_NAME,
            int(remaining),
        )


def detect(text: str) -> DetectorResult | None:
    """Hasil penilaian detektor, atau None kalau tidak bisa dipakai.

    None berarti satu hal saja bagi pemanggil: jatuh ke lapisan berikutnya.
    Semua kegagalan diratakan menjadi None dengan sengaja, karena tidak ada satu
    pun di antaranya yang boleh menggagalkan pengumpulan tugas mahasiswa.
    Mahasiswa yang jawabannya hilang karena API pihak ketiga sedang mati adalah
    kerusakan yang jauh lebih besar daripada satu skor yang tidak terisi.
    """
    api_key = os.getenv("WINSTON_API_KEY", "").strip()
    if not api_key:
        return None

    # Bukan warning. Fitur mati bukan kegagalan, dan log yang berisik saat
    # semuanya normal membuat log yang benar benar penting ikut terabaikan.
    if not MIN_CHARS <= len(text) <= MAX_CHARS:
        logger.info(
            "Teks %d karakter di luar rentang %d sampai %d yang diterima %s, "
            "memakai jalur lain",
            len(text),
            MIN_CHARS,
            MAX_CHARS,
            PROVIDER_NAME,
        )
        return None

    try:
        response = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "text": text,
                # Skor per kalimat tidak dipakai di mana pun. Mematikannya
                # memperkecil payload balasan; kalau nanti ritme kalimat mau
                # memakainya, nyalakan di situ.
                "sentences": False,
                "language": LANGUAGE,
                "version": MODEL_VERSION,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        # Kredit habis. Dipisahkan dari galat lain karena inilah kondisi yang
        # paling mungkin ditemui di lapangan, dan penanganannya berbeda: bukan
        # bug yang perlu dicari, melainkan saldo yang perlu diisi. Pesannya
        # harus bisa dikenali sekali baca di log.
        if response.status_code == 402:
            logger.warning(
                "%s menolak dengan 402: kredit habis. Skor AI memakai jalur "
                "cadangan sampai saldo diisi.",
                PROVIDER_NAME,
            )
            return None
        if response.status_code == 429:
            logger.warning(
                "%s membatasi laju permintaan (429). Skor AI memakai jalur "
                "cadangan untuk submission ini.",
                PROVIDER_NAME,
            )
            return None
        response.raise_for_status()
        payload = response.json()
        human_score = float(payload["score"])
        _warn_if_credits_low(payload)
    except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
        logger.warning("%s gagal, memakai jalur cadangan: %s", PROVIDER_NAME, exc)
        return None

    # Kontraknya 0..100. Nilai di luar rentang berarti kontraknya berubah, dan
    # menjepitnya diam diam akan menyembunyikan perubahan itu sampai ada yang
    # curiga pada angka di layar dosen. Lebih baik mundur ke jalur cadangan.
    if not 0.0 <= human_score <= 100.0:
        logger.warning(
            "Skor %s di luar rentang 0..100: %r", PROVIDER_NAME, human_score
        )
        return None

    return DetectorResult(
        # Inilah pembalikannya. Lihat docstring DetectorResult.
        ai_probability=1.0 - (human_score / 100.0),
        reliable=len(text) >= RELIABLE_MIN_CHARS,
        attack_kinds=_attack_kinds(payload if isinstance(payload, dict) else {}),
    )
