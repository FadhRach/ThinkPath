# E2 tambahan: level Bloom pada soal berlabel

## Data

216 soal Indonesia (prawiraadam/finalproject) dan 240 soal Inggris (Yahya dkk. 2012), maksimal 40 per level.

## Penilai

| penilai | n | tepat | selisih ≤1 | kappa kuadrat |
|---|---|---|---|---|
| Groq, soal Indonesia | 216.0 | 0.352 | 0.676 | 0.387 |
| Groq, soal Yahya (Inggris) | 240.0 | 0.571 | 0.775 | 0.682 |
| Kamus Krathwohl, soal Indonesia | 21.0 | 0.19 | 0.333 | -0.0 |

## Ketepatan Groq per level

| level | indonesia | yahya |
|---|---|---|
| L1 Mengingat | 0.65 | 0.72 |
| L2 Memahami | 0.2 | 0.52 |
| L3 Menerapkan | 0.65 | 0.32 |
| L4 Menganalisis | 0.15 | 0.55 |
| L5 Mengevaluasi | 0.16 | 0.57 |
| L6 Mencipta | 0.21 | 0.72 |

## Kamus kata kerja heuristik

| kamus | soal | ada kata kerja | tepat (dari yang ada) | selisih ≤1 |
|---|---|---|---|---|
| kamus lama | 216 | 10% | 0.19 | 0.333 |
| kamus Krathwohl | 216 | 10% | 0.19 | 0.333 |

Penaksir produksi pada soal: 100% soal jatuh ke L1 karena batas panjang.

## Batasan

- Label dataset melekat pada soal, bukan pada jawaban mahasiswa.
- Pelabel dan kesepakatan antar-pelabel dataset Indonesia tidak dilaporkan.
- Groq di sini memakai prompt pendek khusus soal, bukan prompt produksi.
- Soal pilihan ganda dinilai dari kalimat soalnya saja, tanpa teks bacaan.
- Kamus kata kerja Krathwohl (2002); penaksir produksi tidak diuji karena dirancang untuk teks panjang.
