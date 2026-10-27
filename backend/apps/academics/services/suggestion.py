"""Saran untuk dosen saat memeriksa satu jawaban: sudah baik, perlu Cek Paham, atau dibandingkan.

Dua lapis:
1. Aturan lokal (selalu ada). Disusun dari bukti yang sudah ada: level Bloom terhadap target,
   indikasi AI, penanda gaya, kemiripan dengan jawaban lain, dan pola proses. Tidak ada data
   yang keluar dari server ThinkPath.
2. Narasi Groq (opsional). Hanya bila mahasiswa mengizinkan analisis di luar negeri, kunci
   tersedia, dan jawaban tidak memuat kalimat yang menyasar penilai. Merangkum jawaban terhadap
   instruksi tugas dan menyiapkan draf umpan balik. Tidak pernah mengubah skor atau nilai.

Saran ini bahan pertimbangan. Ia tidak pernah menyarankan sanksi, dan kata kerjanya selalu
"tanyakan" atau "periksa", bukan "putuskan".
"""
from __future__ import annotations

import logging

from django.db.models import Avg, Count
from rest_framework import status
from rest_framework.exceptions import APIException

from apps.academics.models import Submission, SubmissionStatus
from apps.academics.services.analysis_jobs import allows_external_analysis
from apps.analysis.engines.similarity import most_similar
from apps.analysis.engines.style_markers import find_style_markers
from apps.analysis.injection import injection_markers
from apps.analysis.providers import groq, groq_suggest

logger = logging.getLogger(__name__)

SIMILAR_STRONG = 0.25
STRONG_MARKERS_FOR_CEKPAHAM = 3
MAX_OTHERS = 300

LEVEL_NAME = {1: "Mengingat", 2: "Memahami", 3: "Menerapkan", 4: "Menganalisis", 5: "Mengevaluasi", 6: "Mencipta"}


class AnalysisNotReady(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Analisis jawaban ini belum selesai. Tunggu sampai hasilnya muncul."
    default_code = "analysis_not_ready"


def peers_of(submission: Submission) -> list[tuple[str, str, str]]:
    """Jawaban lain pada tugas yang sama: (id, nama, teks), untuk dibandingkan."""
    rows = (
        Submission.objects.filter(assignment_id=submission.assignment_id)
        .exclude(pk=submission.pk)
        .exclude(text_answer="")
        .exclude(status=SubmissionStatus.DRAFT)
        .select_related("student_profile")[:MAX_OTHERS]
    )
    return [(str(row.pk), row.student_profile.label, row.text_answer) for row in rows]


def _class_context(submission: Submission) -> dict:
    stats = Submission.objects.filter(
        assignment_id=submission.assignment_id, status=SubmissionStatus.REVIEWED
    ).aggregate(count=Count("id"), grade=Avg("grade"))
    bloom = submission.assignment.submissions.filter(analysis__isnull=False).aggregate(
        bloom=Avg("analysis__bloom_level")
    )["bloom"]
    return {
        "graded": stats["count"],
        "average_grade": round(stats["grade"], 1) if stats["grade"] is not None else None,
        "average_level": round(bloom, 1) if bloom is not None else None,
    }


def _verdict(
    *, target: int, level: int, ai_band: str, strong: int, similar_top: float, process_attention: bool
) -> str:
    if similar_top >= SIMILAR_STRONG:
        return "bandingkan"
    # Jawaban yang ditempel sekaligus adalah bukti proses; jangan disebut "tidak ada bukti".
    if ai_band == "high" or strong >= STRONG_MARKERS_FOR_CEKPAHAM or process_attention:
        return "cekpaham"
    if level < target:
        return "tinjau"
    return "baik"


_HEADLINE = {
    "baik": "Jawaban tampak memenuhi tugas",
    "tinjau": "Jawaban belum mencapai kedalaman yang diminta",
    "cekpaham": "Pertimbangkan Cek Paham sebelum menilai",
    "bandingkan": "Bandingkan dulu dengan jawaban yang mirip",
}
_STEPS = {
    "baik": ["Nilai dan beri umpan balik seperti biasa.", "Tidak ada bukti yang menuntut tindak lanjut."],
    "tinjau": [
        "Beri umpan balik yang mengarahkan ke level yang diminta (mis. minta alasan, perbandingan, atau penilaian).",
        "Ini temuan kedalaman, bukan dugaan kecurangan.",
    ],
    "cekpaham": [
        "Minta Cek Paham agar mahasiswa menjelaskan jawabannya sendiri secara lisan.",
        "Nilai setelah hasil Cek Paham ada, atau nilai dulu dan catat bahwa tinjauan lisan menyusul.",
    ],
    "bandingkan": [
        "Buka jawaban yang mirip dan baca bagian yang sama persis.",
        "Bila memang sama, tanyakan kepada kedua mahasiswa bagaimana mereka mengerjakannya; satu sumber bacaan yang sama juga bisa membuat dua jawaban mirip.",
    ],
}


def rule_based(submission: Submission, analysis, markers: dict, similar: list[dict]) -> dict:
    """Kerangka saran dari aturan; semua kalimat bisa ditelusuri ke satu angka bukti."""
    target = submission.assignment.expected_bloom_level
    level = analysis.bloom_level
    similar_top = similar[0]["score"] if similar else 0.0
    strong = markers["strong_total"]
    process_attention = not submission.is_imported and analysis.process_band == "attention"
    verdict = _verdict(
        target=target, level=level, ai_band=analysis.ai_band, strong=strong, similar_top=similar_top,
        process_attention=process_attention,
    )

    points = [
        f"Level Bloom hasil L{level} ({LEVEL_NAME.get(level, '-')}) terhadap target L{target} "
        f"({LEVEL_NAME.get(target, '-')}): "
        + ("sesuai atau melampaui target." if level >= target else f"{target - level} tingkat di bawah target.")
    ]
    band_text = {"low": "rendah", "mid": "sedang", "high": "tinggi"}[analysis.ai_band]
    points.append(f"Indikasi AI {band_text} (skor {analysis.ai_score}), masih berupa dugaan dari teks.")
    if strong:
        names = ", ".join(m["label"].lower() for m in markers["markers"] if m["tier"] == "strong")
        points.append(f"Ada {strong} penanda sisa salinan obrolan ({names}).")
    if similar:
        top = similar[0]
        points.append(f"Kemiripan {round(top['score'] * 100)}% dengan jawaban {top['student_name']}.")
    if submission.is_imported:
        points.append("Jawaban diimpor dari dokumen: pola proses mengetik tidak dinilai.")
    elif process_attention:
        points.append("Pola pengerjaan (waktu dan kurva kata) layak dilihat.")
    if submission.revision_count:
        points.append(f"Direvisi {submission.revision_count} kali setelah dikumpulkan.")

    return {
        "verdict": verdict,
        "headline": _HEADLINE[verdict],
        "points": points,
        "next_steps": _STEPS[verdict],
        "caveats": [
            "Saran ini bahan pertimbangan, bukan vonis, dan tidak menjadi dasar sanksi.",
            "Keputusan penilaian tetap di tangan Anda.",
        ],
    }


def _facts_text(submission: Submission, analysis, markers: dict, similar: list[dict], context: dict) -> str:
    assignment = submission.assignment
    lines = [
        f"Judul tugas: {assignment.title}",
        f"Instruksi tugas: {(assignment.instructions or '(tidak ada)')[:1500]}",
        f"Target level Bloom dosen: L{assignment.expected_bloom_level}",
        f"Level Bloom hasil jawaban: L{analysis.bloom_level} (keyakinan {analysis.bloom_confidence})",
        f"Indikasi AI: {analysis.ai_band} (skor {analysis.ai_score}) - hanya dugaan",
        f"Penanda sisa salinan obrolan: {markers['strong_total']}",
        f"Jawaban diimpor dari dokumen: {'ya' if submission.is_imported else 'tidak'}",
        f"Jumlah revisi: {submission.revision_count}",
    ]
    if similar:
        lines.append(f"Kemiripan tertinggi dengan jawaban lain: {round(similar[0]['score'] * 100)}%")
    if context["average_level"] is not None:
        lines.append(f"Rata-rata level Bloom kelas pada tugas ini: L{context['average_level']}")
    return "\n".join(lines)


def build_suggestion(submission: Submission) -> dict:
    analysis = getattr(submission, "analysis", None)
    if analysis is None or submission.analysis_state != "done":
        raise AnalysisNotReady()

    text = submission.text_answer
    markers = find_style_markers(text)
    similar = most_similar(text, peers_of(submission))
    context = _class_context(submission)
    result = rule_based(submission, analysis, markers, similar)
    result["similar"] = similar
    result["class_context"] = context
    result["narrative"] = None
    result["source"] = "aturan"

    # Narasi di luar negeri hanya dengan izin, kunci, dan jawaban yang tidak menyasar penilai.
    if not allows_external_analysis(submission):
        result["narrative_skipped"] = "Mahasiswa tidak mengizinkan analisis di luar negeri, jadi saran hanya dari aturan lokal."
    elif not groq.is_configured():
        result["narrative_skipped"] = "Layanan narasi belum dikonfigurasi."
    elif injection_markers(text):
        result["narrative_skipped"] = "Jawaban memuat kalimat yang ditujukan kepada penilai otomatis, jadi narasi AI tidak dipakai."
    else:
        try:
            result["narrative"] = groq_suggest.call(
                _facts_text(submission, analysis, markers, similar, context), text
            )
            result["source"] = "aturan+groq"
        except Exception:  # noqa: BLE001 - saran lokal tetap berguna bila narasi gagal
            logger.warning("Narasi saran gagal untuk submission %s", submission.pk, exc_info=True)
            result["narrative_skipped"] = "Narasi AI sedang tidak tersedia; saran dari aturan lokal tetap berlaku."
    return result
