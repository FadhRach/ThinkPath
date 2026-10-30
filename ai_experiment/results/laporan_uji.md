# Laporan Uji ThinkPath: E1, E2, dan Cek Paham

## Ringkas

E1 pada ambang sedang, data gabungan:
- groq: salah tuduh 27/45 tulisan manusia (FPR 60.0%), F1 0.51.
- heuristik: salah tuduh 11/45 tulisan manusia (FPR 24.4%), F1 0.74.
- winston: salah tuduh 2/18 tulisan manusia (FPR 11.1%), F1 0.83.

E2: F1 makro tertinggi 0.57 (Soal Yahya (11), Groq).

Cek Paham: WER terendah 6.3% (groq-large-v3).

## E1: deteksi AI (positif = AI)

FPR = salah tuduh dari semua tulisan manusia. FDR = salah tuduh dari semua teks yang ditandai AI. Winston pada data gabungan hanya 18 teks manusia dan 5 esai AI.

### Gabungan

| detektor | aturan | manusia | AI | TP | FP | TN | FN | akurasi | presisi | recall (TPR) | spesifisitas (TNR) | FPR (salah tuduh / manusia) | FDR (salah tuduh / yang ditandai) | FP / semua teks | F1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| groq | sedang (42+) | 45 | 25 | 18 | 27 | 18 | 7 | 51.4% | 40.0% | 72.0% | 40.0% | 60.0% | 60.0% | 38.6% | 51.4% |
| groq | tinggi (70+) | 45 | 25 | 4 | 7 | 38 | 21 | 60.0% | 36.4% | 16.0% | 84.4% | 15.6% | 63.6% | 10.0% | 22.2% |
| heuristik | sedang (42+) | 45 | 25 | 21 | 11 | 34 | 4 | 78.6% | 65.6% | 84.0% | 75.6% | 24.4% | 34.4% | 15.7% | 73.7% |
| heuristik | tinggi (70+) | 45 | 25 | 0 | 0 | 45 | 25 | 64.3% | - | 0.0% | 100.0% | 0.0% | - | 0.0% | - |
| winston | sedang (35+) | 18 | 5 | 5 | 2 | 16 | 0 | 91.3% | 71.4% | 100.0% | 88.9% | 11.1% | 28.6% | 8.7% | 83.3% |
| winston | tinggi (70+) | 18 | 5 | 5 | 2 | 16 | 0 | 91.3% | 71.4% | 100.0% | 88.9% | 11.1% | 28.6% | 8.7% | 83.3% |

### Pilot (notebook 07)

| detektor | aturan | manusia | AI | TP | FP | TN | FN | akurasi | presisi | recall (TPR) | spesifisitas (TNR) | FPR (salah tuduh / manusia) | FDR (salah tuduh / yang ditandai) | FP / semua teks | F1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| groq | sedang (42+) | 5 | 5 | 5 | 4 | 1 | 0 | 60.0% | 55.6% | 100.0% | 20.0% | 80.0% | 44.4% | 40.0% | 71.4% |
| groq | tinggi (70+) | 5 | 5 | 0 | 0 | 5 | 5 | 50.0% | - | 0.0% | 100.0% | 0.0% | - | 0.0% | - |
| heuristik | sedang (42+) | 5 | 5 | 4 | 1 | 4 | 1 | 80.0% | 80.0% | 80.0% | 80.0% | 20.0% | 20.0% | 10.0% | 80.0% |
| heuristik | tinggi (70+) | 5 | 5 | 0 | 0 | 5 | 5 | 50.0% | - | 0.0% | 100.0% | 0.0% | - | 0.0% | - |
| winston | sedang (35+) | 5 | 5 | 5 | 0 | 5 | 0 | 100.0% | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| winston | tinggi (70+) | 5 | 5 | 5 | 0 | 5 | 0 | 100.0% | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% |

### Lanjutan (notebook 10)

| detektor | aturan | manusia | AI | TP | FP | TN | FN | akurasi | presisi | recall (TPR) | spesifisitas (TNR) | FPR (salah tuduh / manusia) | FDR (salah tuduh / yang ditandai) | FP / semua teks | F1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| groq | sedang (42+) | 40 | 20 | 13 | 23 | 17 | 7 | 50.0% | 36.1% | 65.0% | 42.5% | 57.5% | 63.9% | 38.3% | 46.4% |
| groq | tinggi (70+) | 40 | 20 | 4 | 7 | 33 | 16 | 61.7% | 36.4% | 20.0% | 82.5% | 17.5% | 63.6% | 11.7% | 25.8% |
| heuristik | sedang (42+) | 40 | 20 | 17 | 10 | 30 | 3 | 78.3% | 63.0% | 85.0% | 75.0% | 25.0% | 37.0% | 16.7% | 72.3% |
| heuristik | tinggi (70+) | 40 | 20 | 0 | 0 | 40 | 20 | 66.7% | - | 0.0% | 100.0% | 0.0% | - | 0.0% | - |
| winston | sedang (35+) | 13 | 0 | 0 | 2 | 11 | 0 | 84.6% | 0.0% | - | 84.6% | 15.4% | 100.0% | 15.4% | - |
| winston | tinggi (70+) | 13 | 0 | 0 | 2 | 11 | 0 | 84.6% | 0.0% | - | 84.6% | 15.4% | 100.0% | 15.4% | - |

## E2: level Bloom (6 kelas)

| uji | n | akurasi | presisi makro | recall makro | F1 makro | F1 berbobot | selisih maks. 1 | kappa kuadrat |
|---|---|---|---|---|---|---|---|---|
| Jawaban terkontrol (09), heuristik | 58 | 27.6% | 44.1% | 27.6% | 22.2% | 21.9% | 69.0% | 0.43 |
| Jawaban terkontrol (09), Groq | 58 | 31.0% | 33.0% | 31.3% | 27.8% | 28.0% | 74.1% | 0.558 |
| Soal Indonesia (11), Groq | 216 | 35.2% | 40.6% | 33.7% | 32.0% | 32.0% | 67.6% | 0.387 |
| Soal Yahya (11), Groq | 240 | 57.1% | 57.1% | 57.1% | 56.8% | 56.8% | 77.5% | 0.682 |
| Soal Indonesia (11), kamus kata kerja | 21 | 19.0% | 40.7% | 20.0% | 24.8% | 23.6% | 33.3% | -0.0 |

### F1 per level

| level | Jawaban terkontrol (09), heuristik | Jawaban terkontrol (09), Groq | Soal Indonesia (11), Groq | Soal Yahya (11), Groq | Soal Indonesia (11), kamus kata kerja |
|---|---|---|---|---|---|
| L1 | 0.33 | 0.0 | 0.46 | 0.76 | 0.0 |
| L2 | 0.0 | 0.13 | 0.21 | 0.53 | 0.4 |
| L3 | 0.17 | 0.15 | 0.49 | 0.35 | 0.22 |
| L4 | 0.37 | 0.19 | 0.2 | 0.55 | 0.0 |
| L5 | 0.29 | 0.44 | 0.23 | 0.58 | 0.33 |
| L6 | 0.18 | 0.75 | 0.33 | 0.63 | 0.29 |

## Cek Paham: ASR (WER)

| model | klip | gagal | WER (CI 95%) | CER | latensi median | latensi p95 | RTF median |
|---|---|---|---|---|---|---|---|
| groq-turbo | 687 | 0 | 7.1% (6.5%-7.8%) | 2.3% | 0.868 | 1.457 | 0.07 |
| groq-large-v3 | 687 | 0 | 6.3% (5.7%-7.0%) | 2.0% | 1.092 | 3.086 | 0.089 |
| faster-whisper-small | 687 | 0 | 16.1% (15.1%-17.1%) | 4.6% | 2.283 | 3.595 | 0.195 |

## Batasan

- E1: tulisan manusia lanjutan berasal dari artikel akademisi yang disunting, bukan esai mahasiswa. Winston hanya menilai sebagian teks karena kredit terbatas.
- E2: label notebook 09 adalah level yang diminta ke generator; label notebook 11 melekat pada soal, bukan jawaban. Kamus kata kerja hanya bisa dinilai pada soal yang memuat kata kerja.
- Cek Paham: FLEURS berisi kalimat yang dibacakan dengan jelas, sedangkan jawaban Cek Paham spontan.
