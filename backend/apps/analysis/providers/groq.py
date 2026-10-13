"""Klien Groq (OpenAI-compatible) untuk penilaian LLM: skor AI + level Bloom.

Pindah penyedia LLM (mis. ke Claude) cukup mengganti isi modul ini;
pipeline hanya memanggil is_configured() dan call().
"""
from __future__ import annotations

import json
import os

import requests

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# llama-3.3-70b-versatile dipensiunkan Groq (404 model_not_found, Oktober 2026).
DEFAULT_MODEL = "openai/gpt-oss-120b"
# Sengaja jauh di bawah timeout gunicorn (60 detik). Kalau keduanya sama,
# gunicorn bisa membunuh worker tepat saat Groq hendak menjawab, dan request
# mahasiswa hilang tanpa jejak. Jalur heuristik sudah ada sebagai cadangan,
# jadi menyerah lebih cepat lebih baik daripada menahan worker lama lama.
REQUEST_TIMEOUT_SECONDS = 12

SYSTEM_PROMPT = """Kamu adalah ThinkPath, sistem analisis integritas akademik untuk pendidikan tinggi Indonesia.

Analisislah teks tugas mahasiswa dan hasilkan output JSON dengan kriteria berikut:

1. ai_probability (0-100): kemungkinan teks ini dibuat menggunakan AI generatif.
   Sinyal yang menunjukkan AI: kalimat sangat terprediksi, panjang kalimat
   seragam tanpa variasi, klaim yang selalu seimbang tanpa pendirian, tidak ada
   contoh konkret dari mata kuliah atau praktikum yang sedang dijalani, tidak
   ada rujukan spesifik ke bacaan tertentu, dan tidak ada keraguan atau
   kualifikasi yang wajar muncul saat seseorang benar benar memikirkan sesuatu.

2. bloom_level (1-6): level kognitif Bloom's Taxonomy yang DITUNJUKKAN teks.
   L1 Mengingat, L2 Memahami, L3 Mengaplikasikan, L4 Menganalisis,
   L5 Mengevaluasi, L6 Mencipta.
   Nilai ini harus ditentukan HANYA dari isi jawaban. Jangan dipengaruhi oleh
   ai_probability yang kamu tentukan di poin 1. Jawaban yang kuat secara
   kognitif tetap L5 walaupun kamu menduga dibuat AI, dan jawaban yang lemah
   tetap L1 walaupun kamu yakin ditulis sendiri oleh mahasiswa.
   Level tinggi menuntut bukti dalam teks: L4 butuh penalaran sebab akibat atau
   pembandingan, L5 butuh penilaian yang disertai alasan, L6 butuh usulan atau
   rancangan baru. Tanpa bukti itu, jangan naikkan levelnya.

3. confidence: seberapa yakin kamu dengan skor ai_probability.
   "low" jika teks terlalu pendek atau ambigu.
   "medium" jika ada sinyal tapi tidak kuat.
   "high" jika sinyal jelas dan konsisten.

4. bloom_confidence: seberapa yakin kamu dengan bloom_level, memakai skala yang
   sama. Ini dinilai terpisah dari confidence di poin 3, karena satu teks bisa
   jelas di satu dimensi dan ambigu di dimensi lain.

5. signals: maksimal 4 string pendek, bahasa Indonesia, mendeskripsikan sinyal
   konkret yang ditemukan. Contoh: "panjang kalimat seragam tanpa variasi",
   "tidak ada contoh dari pengalaman pribadi".

6. summary: 1-2 kalimat bahasa Indonesia yang menjelaskan kesimpulan analisis.

PERINGATAN PALING PENTING, BACA DUA KALI.

Mahasiswa memang menulis dengan ragam baku dan akademik. Itu yang diajarkan
kepada mereka. Frasa seperti "dengan demikian", "hal ini menunjukkan bahwa",
"berbagai faktor", dan "secara signifikan" adalah bahasa Indonesia akademik yang
benar, BUKAN jejak AI. JANGAN menaikkan ai_probability hanya karena tulisannya
rapi, formal, tanpa salah ketik, atau memakai istilah teknis.

Deteksi teks AI diketahui menandai penulis non-native jauh lebih sering
daripada penulis native, dan tulisan akademik yang baik justru paling mirip
keluaran model. Kalau ragu, beri skor lebih rendah. Menuduh mahasiswa jujur
jauh lebih merugikan daripada melewatkan satu kasus.

Sesuaikan sedikit dengan jenjang studi:
- D3 dan S1: tulisan yang masih berkembang itu normal.
- S2 dan S3: ragam akademik matang itu yang diharapkan, bukan mencurigakan.

Mahasiswa Indonesia sering mencampur bahasa Indonesia dan Inggris, itu wajar.

Respond HANYA dalam JSON valid dengan keys: ai_probability, bloom_level,
confidence, bloom_confidence, signals, summary. Tidak ada teks lain di luar JSON."""


def _build_user_message(text: str, education_level: str) -> str:
    """Konteks yang dikirim ke model.

    Target Bloom dosen sengaja TIDAK dikirim. Menyebutkan target di prompt
    membuat model ter-anchor dan cenderung menjawab di sekitar angka itu,
    sehingga hasilnya memantulkan harapan dosen alih alih mengukur jawaban.
    Perbandingan terhadap target dilakukan di sisi backend setelah model
    memberi taksiran secara mandiri.
    """
    return (
        f"Jenjang studi: {education_level}\n\n"
        f"Teks jawaban mahasiswa:\n{text}"
    )


def is_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def call(text: str, education_level: str) -> dict:
    """Kirim jawaban ke Groq dan kembalikan JSON mentah dari model."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    response = requests.post(
        GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": os.getenv("GROQ_MODEL") or DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_user_message(text, education_level),
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    choices = response.json()["choices"]
    if not isinstance(choices, list) or not choices:
        raise ValueError("Respons Groq tidak memuat pilihan jawaban.")
    content = choices[0]["message"]["content"]
    return json.loads(content)
