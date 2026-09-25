"""Persetujuan pemrosesan data pribadi menurut UU No. 27 Tahun 2022 (UU PDP).

Satu versi Kebijakan Privasi berlaku pada satu waktu. Isinya ada di frontend
(`/kebijakan-privasi`), dan versinya harus sama dengan konstanta di bawah;
tes memeriksa keduanya supaya tidak menyimpang diam-diam.

Butir persetujuan dipisah per tujuan karena Pasal 22 ayat (4) mewajibkan
permintaan persetujuan yang memuat tujuan lain dapat dibedakan secara jelas.
Persetujuan yang tidak memenuhi ketentuan itu batal demi hukum (ayat (5)).
"""
from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta
from uuid import UUID

from django.utils import timezone

from .models import ConsentAction, ConsentRecord, Role

# Tanggal berlaku versi kebijakan. Mengubahnya membuat semua persetujuan lama
# tidak berlaku, sehingga setiap pengguna diminta membaca dan menyetujui ulang
# sebelum pemrosesan berlanjut dengan ketentuan baru (Pasal 21 ayat (2)).
PRIVACY_POLICY_VERSION = "2026-09-25"

# Data akun, kelas, jawaban, nilai, dan umpan balik untuk perkuliahan,
# termasuk penyimpanannya di penyedia cloud di luar Indonesia.
ITEM_COURSE_DATA = "data_perkuliahan"
# Perekaman jumlah kata tiap 30 detik dan analisis otomatis (level Bloom dan
# indikasi penggunaan AI) sebagai bahan tinjau dosen.
ITEM_PROCESS_ANALYSIS = "analisis_proses"
# Berusia 18 tahun ke atas, atau orang tua/wali sudah menyetujui (Pasal 25).
ITEM_AGE = "usia_atau_izin_wali"
# Dosen: memakai data mahasiswa hanya untuk kelasnya, menjaga kerahasiaan,
# dan tidak menjatuhkan sanksi hanya berdasarkan skor.
ITEM_TEACHER_DUTIES = "tanggung_jawab_dosen"
# Opsional: teks jawaban boleh dikirim ke Groq (AS) dan Winston AI (Kanada).
# Tanpa butir ini, jawaban hanya dianalisis heuristik di server ThinkPath.
ITEM_EXTERNAL_AI = "analisis_luar_negeri"

REQUIRED_ITEMS: dict[str, tuple[str, ...]] = {
    Role.STUDENT: (ITEM_COURSE_DATA, ITEM_PROCESS_ANALYSIS, ITEM_AGE),
    Role.TEACHER: (ITEM_COURSE_DATA, ITEM_TEACHER_DUTIES),
}
OPTIONAL_ITEMS: dict[str, tuple[str, ...]] = {
    Role.STUDENT: (ITEM_EXTERNAL_AI,),
    Role.TEACHER: (),
}


def latest_record(profile_id: UUID) -> ConsentRecord | None:
    return (
        ConsentRecord.objects.filter(profile_id=profile_id)
        .order_by("-created_at")
        .first()
    )


def record_consent(profile_id: UUID, action: str, items: Iterable[str]) -> ConsentRecord:
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


def allows_external_ai(profile_id: UUID) -> bool:
    """Apakah teks jawaban boleh dikirim ke penyedia analisis di luar negeri.

    Pasal 56 ayat (4): bila kesetaraan pelindungan di negara tujuan belum
    dapat dipastikan, transfer wajib atas persetujuan Subjek Data Pribadi.
    """
    record = current_consent(profile_id)
    return record is not None and ITEM_EXTERNAL_AI in record.items


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
        "external_ai": current is not None and ITEM_EXTERNAL_AI in current.items,
        "given_at": given_at,
        "history": [
            {
                "action": record.action,
                "policy_version": record.policy_version,
                "items": list(record.items),
                "created_at": record.created_at,
            }
            for record in history
        ],
    }
