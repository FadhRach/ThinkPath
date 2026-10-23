"""Persetujuan pemrosesan data pribadi menurut UU No. 27 Tahun 2022 (UU PDP).

Satu versi Kebijakan Privasi berlaku pada satu waktu. Isinya ada di frontend
(`/kebijakan-privasi`), dan versinya harus sama dengan konstanta di bawah;
tes memeriksa keduanya supaya tidak menyimpang diam-diam.

Pengguna menyetujui satu kali, di form daftar. Tiap tujuan tetap tercatat
sebagai butir tersendiri di bukti persetujuan dan dijelaskan terpisah di
halaman kebijakan, karena Pasal 22 ayat (4) mewajibkan tujuan yang berbeda
dapat dibedakan secara jelas. Persetujuan yang tidak memenuhi ketentuan itu
batal demi hukum (ayat (5)).
"""
from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta
from uuid import UUID

from django.utils import timezone

from apps.accounts.models import ConsentAction, ConsentRecord, Role

# Tanggal berlaku versi kebijakan. Mengubahnya membuat semua persetujuan lama
# tidak berlaku, sehingga setiap pengguna diminta membaca dan menyetujui ulang
# sebelum pemrosesan berlanjut dengan ketentuan baru (Pasal 21 ayat (2)).
PRIVACY_POLICY_VERSION = "2026-10-23"

# Data akun, kelas, jawaban, nilai, dan umpan balik untuk perkuliahan,
# termasuk dokumen yang diunggah, penyimpanannya di VPS Jakarta, dan
# penyajian halaman oleh Vercel.
ITEM_COURSE_DATA = "data_perkuliahan"
# Perekaman jumlah kata tiap 30 detik dan analisis otomatis (level Bloom dan
# indikasi penggunaan AI) sebagai bahan tinjau dosen.
ITEM_PROCESS_ANALYSIS = "analisis_proses"
# Berusia 18 tahun ke atas, atau orang tua/wali sudah menyetujui (Pasal 25).
ITEM_AGE = "usia_atau_izin_wali"
# Dosen: memakai data mahasiswa hanya untuk kelasnya, menjaga kerahasiaan,
# dan tidak menjatuhkan sanksi hanya berdasarkan skor.
ITEM_TEACHER_DUTIES = "tanggung_jawab_dosen"
# Teks jawaban dikirim ke Groq (AS) dan Winston AI (Kanada), begitu pula
# gambar halaman dokumen scan/foto yang diunggah untuk dibaca. Tanpa butir ini
# di catatan persetujuan, jawaban hanya dianalisis heuristik di server
# ThinkPath dan dokumen yang butuh pembacaan gambar ditolak.
ITEM_EXTERNAL_AI = "analisis_luar_negeri"
# Suara mahasiswa direkam saat menjawab Cek Paham, disimpan di VPS Jakarta, dan
# dikirim ke Groq (AS) untuk ditranskripsi. Berlaku bersama ITEM_EXTERNAL_AI
# karena pengiriman audio itu transfer ke luar negeri.
ITEM_VOICE_CEKPAHAM = "rekaman_suara_cekpaham"

# Semua butir wajib: satu centang di form daftar menyetujui seluruhnya.
REQUIRED_ITEMS: dict[str, tuple[str, ...]] = {
    Role.STUDENT: (
        ITEM_COURSE_DATA,
        ITEM_PROCESS_ANALYSIS,
        ITEM_AGE,
        ITEM_EXTERNAL_AI,
        ITEM_VOICE_CEKPAHAM,
    ),
    Role.TEACHER: (ITEM_COURSE_DATA, ITEM_TEACHER_DUTIES),
}

# Asal baris persetujuan, untuk bukti bagaimana persetujuan diperoleh.
SOURCE_REGISTER = "register"
SOURCE_REACCEPT = "reaccept"
SOURCE_WITHDRAW = "withdraw"
SOURCE_SEED = "seed"


def items_for(role: str) -> tuple[str, ...]:
    """Butir yang disetujui satu centang untuk peran ini."""
    return REQUIRED_ITEMS[role]


def latest_record(profile_id: UUID) -> ConsentRecord | None:
    return (
        ConsentRecord.objects.filter(profile_id=profile_id)
        .order_by("-created_at")
        .first()
    )


def record_consent(
    profile_id: UUID, action: str, items: Iterable[str], *, source: str = ""
) -> ConsentRecord:
    """Tambahkan satu peristiwa persetujuan untuk versi kebijakan yang berlaku.

    Waktunya dipaksa selalu naik: dua peristiwa berurutan yang kebetulan
    tercatat pada mikrodetik yang sama akan membuat "baris terbaru" ambigu.
    """
    now = timezone.now()
    latest = latest_record(profile_id)
    if latest is not None and now <= latest.created_at:
        now = latest.created_at + timedelta(microseconds=1)
    return ConsentRecord.objects.create(
        profile_id=profile_id,
        action=action,
        policy_version=PRIVACY_POLICY_VERSION,
        items=sorted(set(items)),
        source=source,
        created_at=now,
    )


def current_consent(profile_id: UUID) -> ConsentRecord | None:
    """Persetujuan yang berlaku sekarang, atau None.

    None berarti belum pernah memberi, sudah menarik, atau yang diberikan
    untuk versi kebijakan lama. Ketiganya sama akibatnya: pemrosesan baru
    tidak boleh berjalan sampai pengguna menyetujui versi yang berlaku.
    """
    record = latest_record(profile_id)
    if (
        record is None
        or record.action == ConsentAction.WITHDRAWN
        or record.policy_version != PRIVACY_POLICY_VERSION
    ):
        return None
    return record


def consent_status(profile_id: UUID) -> dict:
    """Ringkasan untuk layar Pengaturan, beserta rekam jejaknya (Pasal 32)."""
    history = list(
        ConsentRecord.objects.filter(profile_id=profile_id).order_by("-created_at")[:50]
    )
    latest = history[0] if history else None
    current = current_consent(profile_id)
    if current is not None:
        state = "given"
    elif latest is None:
        state = "none"
    elif latest.action == ConsentAction.WITHDRAWN:
        state = "withdrawn"
    else:
        state = "outdated"

    given_at = None
    if current is not None:
        given = next(
            (
                record
                for record in history
                if record.action == ConsentAction.GIVEN
                and record.policy_version == PRIVACY_POLICY_VERSION
            ),
            None,
        )
        given_at = given.created_at if given else current.created_at

    return {
        "current_version": PRIVACY_POLICY_VERSION,
        "status": state,
        "items": list(current.items) if current else [],
        "given_at": given_at,
        "history": [
            {
                "id": str(record.id),
                "action": record.action,
                "policy_version": record.policy_version,
                "items": list(record.items),
                "source": record.source,
                "created_at": record.created_at,
            }
            for record in history
        ],
    }
