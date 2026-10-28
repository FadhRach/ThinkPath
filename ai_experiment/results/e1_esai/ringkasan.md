# E1: tiga detektor pada 10 esai

## Data

5 esai manusia (sebelum 2021) dan 5 esai AI dengan topik yang sama, masing-masing dipotong menjadi 100 kata pertama. Generator AI: openai/gpt-oss-20b.

## Aturan keputusan

| detektor | aturan | FPR | TPR |
|---|---|---|---|
| groq | tinggi (skor 70+) | 0/5 [0%-43%] | 0/5 [0%-43%] |
| groq | sedang ke atas (skor 42+) | 4/5 [38%-96%] | 5/5 [57%-100%] |
| heuristik | tinggi (skor 70+) | 0/5 [0%-43%] | 0/5 [0%-43%] |
| heuristik | sedang ke atas (skor 42+) | 1/5 [4%-62%] | 4/5 [38%-96%] |
| winston | tinggi (skor 70+) | 0/5 [0%-43%] | 5/5 [57%-100%] |
| winston | sedang ke atas (skor 35+) | 0/5 [0%-43%] | 5/5 [57%-100%] |

## AUC dan waktu

| detector | auc | detik_median |
|---|---|---|
| groq | 0.64 | 20.23 |
| heuristik | 0.9 | 0.0 |
| winston | 1.0 | 1.41 |

## Batasan

- Hanya 10 esai, jadi ini studi kasus, bukan akurasi umum.
- Ambang 42/70 untuk Groq dipinjam dari heuristik, belum dikalibrasi.
- Yang diuji hanya potongan 100 kata, bukan esai utuh.
