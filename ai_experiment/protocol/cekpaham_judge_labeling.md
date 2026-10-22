# Protokol melabeli sesi untuk menguji penilai Cek Paham

Dipakai oleh `python -m src.evaluate_cekpaham_judge`. Rubriknya SAMA dengan yang dipakai penilai LLM di
`backend/apps/cekpaham/rubric.py`; baca jangkar levelnya di sana sebelum melabeli.

## Bahan: 30 sesi

Satu sesi = soal tugas + jawaban tertulis mahasiswa + soal konfirmasi dosen + **transkrip** jawaban lisan.
Sebarkan kualitasnya: kira-kira sepertiga jelas paham, sepertiga sebagian, sepertiga lemah atau tidak
menjawab. Sertakan beberapa sesi yang sulit (jawaban benar tetapi terbata-bata, atau fasih tetapi kosong)
dan beberapa jawaban lisan yang sengaja melenceng dari jawaban tertulis.

Transkrip boleh dari rekaman tim sendiri lewat ASR, atau diketik dari rekaman. Jangan memakai data
mahasiswa nyata tanpa izin; ganti nama dan buang identitas.

## Dua penilai manusia, bekerja sendiri-sendiri

Setiap penilai memberi **level 0–3** untuk empat dimensi (`accuracy`, `consistency`, `depth`,
`ownership`) tanpa melihat label penilai lain maupun keluaran LLM. Nilai isi, bukan kelancaran bicara;
abaikan kata pengisi dan kemungkinan salah dengar.

## Format `data/cekpaham_gold/sessions.jsonl` (satu sesi per baris)

```json
{"id": "s01", "question": "...", "assignment_title": "...", "assignment_prompt": "...",
 "main_answer": "...", "transcript": "...", "language": "id", "answer_seconds": 45,
 "ratings": {"penilai_a": {"accuracy": 2, "consistency": 3, "depth": 1, "ownership": 2},
             "penilai_b": {"accuracy": 3, "consistency": 3, "depth": 1, "ownership": 1}}}
```

Berkas ini berisi data pribadi: jangan masuk git (`data/cekpaham_gold/` sudah di `.gitignore`).

## Menjalankan dan membaca hasil

```bash
python -m src.evaluate_cekpaham_judge --sleep 20
```

Biayanya ±90 sesi penilaian (30 asli + 30 injeksi + 30 salah dengar), masing-masing dua jalan. Satu sesi
memakai ±4.100 token dari jatah 8.000 token/menit Groq yang dipakai bersama analisis submission, jadi
selang `--sleep` jangan diperkecil. Hasil di-cache; bila jatah harian habis, jalankan lagi besok.

Urutan membaca laporan: (1) kesepakatan antar manusia adalah langit-langit, (2) penilai vs konsensus,
(3) stabilitas, (4) injeksi tidak boleh menggeser level lebih dari satu, (5) kepekaan terhadap salah dengar.

Bila kriteria gagal, **perbaiki rubrik atau prompt**, bukan ambang band. Ambang 70/40 di `rubric.py`
diisi dan label "belum dikalibrasi" dicabut hanya bila hasil ini mendukung.
