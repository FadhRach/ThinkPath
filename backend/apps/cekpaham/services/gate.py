"""Gerbang persetujuan Cek Paham.

Dibaca dari basis data, bukan klaim token (penarikan persetujuan berlaku
seketika, Pasal 40 UU PDP). Dua butir wajib berlaku bersamaan: rekaman suara,
dan analisis di luar negeri karena audio dikirim ke Groq.
"""
from __future__ import annotations

from uuid import UUID

from rest_framework.exceptions import PermissionDenied

from apps.accounts.privacy import ITEM_EXTERNAL_AI, ITEM_VOICE_CEKPAHAM, current_consent

NEEDS_POLICY = (
    "Setujui Kebijakan Privasi versi terbaru sebelum mengerjakan Cek Paham. "
    "Buka menu Pengaturan atau muat ulang halaman."
)
NEEDS_VOICE = (
    "Cek Paham merekam suaramu dan mengirimnya ke penyedia transkripsi di luar negeri. "
    "Izinkan rekaman suara dan analisis di luar negeri di Pengaturan > Privasi untuk melanjutkan."
)


def consent_state(student_id: UUID) -> dict:
    consent = current_consent(student_id)
    items = set(consent.items) if consent else set()
    voice, external = ITEM_VOICE_CEKPAHAM in items, ITEM_EXTERNAL_AI in items
    return {
        "policy_current": consent is not None,
        "voice": voice,
        "external_ai": external,
        "ready": consent is not None and voice and external,
    }


def require_cekpaham_consent(student_id: UUID) -> None:
    state = consent_state(student_id)
    if not state["policy_current"]:
        raise PermissionDenied(NEEDS_POLICY)
    if not state["ready"]:
        raise PermissionDenied(NEEDS_VOICE)
