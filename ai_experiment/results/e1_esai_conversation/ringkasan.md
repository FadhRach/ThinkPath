# E1 lanjutan: salah tuduh pada 40 potongan tulisan manusia

## Data

40 potongan manusia dari 20 artikel The Conversation Indonesia (2017-2019), 20 esai AI (openai/gpt-oss-20b, qwen/qwen3.8-27b). Semua teks 100-200 kata.

## Aturan keputusan, semua teks

| detektor | aturan | FPR | TPR |
|---|---|---|---|
| groq | tinggi (skor 70+) | 7/40 [9%-32%] | 4/20 [8%-42%] |
| groq | sedang ke atas (skor 42+) | 23/40 [42%-71%] | 13/20 [43%-82%] |
| heuristik | tinggi (skor 70+) | 0/40 [0%-9%] | 0/20 [0%-16%] |
| heuristik | sedang ke atas (skor 42+) | 10/40 [14%-40%] | 17/20 [64%-95%] |
| winston | tinggi (skor 70+) | 2/13 [4%-42%] | - |
| winston | sedang ke atas (skor 35+) | 2/13 [4%-42%] | - |

## Aturan keputusan, 13 teks yang juga dinilai Winston

| detektor | aturan | FPR | TPR |
|---|---|---|---|
| groq | tinggi (skor 70+) | 2/13 [4%-42%] | - |
| groq | sedang ke atas (skor 42+) | 7/13 [29%-77%] | - |
| heuristik | tinggi (skor 70+) | 0/13 [0%-23%] | - |
| heuristik | sedang ke atas (skor 42+) | 3/13 [8%-50%] | - |
| winston | tinggi (skor 70+) | 2/13 [4%-42%] | - |
| winston | sedang ke atas (skor 35+) | 2/13 [4%-42%] | - |

## AUC dan waktu

| detector | auc | detik_median |
|---|---|---|
| groq | 0.576 | 20.02 |
| heuristik | 0.874 | 0.0 |
| winston | nan | 1.65 |

## Batasan

- Tulisan manusia berasal dari akademisi dan sudah disunting redaksi, lebih rapi daripada esai mahasiswa.
- Dua potongan dari artikel yang sama tidak sepenuhnya independen.
- Winston hanya menilai sebagian teks karena kredit terbatas.
- Ambang 42/70 untuk Groq dipinjam dari heuristik, belum dikalibrasi.
