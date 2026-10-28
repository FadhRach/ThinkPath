# E2: level Bloom, heuristik vs Groq

## Data

58 jawaban terkontrol (10 soal x 6 level, sekitar 300 kata), generator: openai/gpt-oss-20b.

## Metrik

| penilai | n | tepat | selisih 1 | Spearman | kappa kuadrat |
|---|---|---|---|---|---|
| heuristik | 58.0 | 0.276 | 0.69 | 0.571 | 0.43 |
| groq | 58.0 | 0.293 | 0.69 | 0.724 | 0.484 |

## Akurasi per level

| level | heuristik | groq |
|---|---|---|
| L1 Mengingat | 0.22 | 0.0 |
| L2 Memahami | 0.0 | 0.0 |
| L3 Menerapkan | 0.1 | 0.1 |
| L4 Menganalisis | 0.9 | 0.2 |
| L5 Mengevaluasi | 0.33 | 0.78 |
| L6 Mencipta | 0.1 | 0.7 |

## Batasan

- Jawaban dibuat model, bukan jawaban mahasiswa asli.
- Label target belum tentu sama dengan penilaian dosen kecuali label_manusia diisi.
