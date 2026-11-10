# apps.analysis: contekan rumus

Semua angka di bawah diambil dari kode (`file:baris` relatif ke `backend/apps/analysis/`).
Skor dan level adalah **bahan tinjau dosen, bukan vonis**.

## Alur `run_analysis` (`pipeline.py:237`)

```
teks ──> analyze_text (heuristik: skor AI + Bloom)          engines/heuristic.py:83
     ├─> Bloom : Groq (bila ada GROQ_API_KEY & tanpa injeksi) pipeline.py:134
     │           gagal / tidak ada -> tetap Bloom heuristik
     │           selisih >= 3 level dari heuristik -> ditandai, keyakinan "low"   pipeline.py:98
     └─> Skor AI: Winston via cache (detector_cache)           pipeline.py:259
                 menjawab -> timpa skor/band/breakdown saja     pipeline.py:173
                 tidak    -> tetap skor heuristik
     + process_band (pola pengerjaan, bobot 0)                 pipeline.py:275
```

- Groq **tidak** memberi skor AI (uji E1 notebook 12: AUC 0,60, salah tuduh 60%; heuristik AUC 0,88).
- Bloom tidak pernah menyentuh detektor AI: Winston hanya menimpa field skor AI pada hasil jadi
  (dikunci tes AST `tests/test_analysis_decoupling.py`).
- Winston mengembalikan skor **manusia** (0 = AI). Dibalik tepat sekali:
  `ai_probability = 1 - human/100` (`providers/winston.py:163`).
- `allow_external=False` (mahasiswa tidak izinkan transfer ke luar negeri): Groq dan Winston dilewati.
- Kegagalan API apa pun jatuh ke lapisan berikutnya; pengumpulan tidak pernah gagal karenanya.

## Fitur teks (`engines/text_features.py`)

| Fitur | Cara hitung | Baris |
|---|---|---|
| kalimat | dipecah pada `.`, `!`, `?` | 218 |
| `burstiness` | `min(1, stdev(panjang kalimat) / mean)` | 283-292 |
| `type_token_ratio` | kata unik / jumlah kata, pada 200 kata pertama | 295-300 |
| `llm_phrase_count` | jumlah **jenis** frasa `LLM_PHRASES` yang muncul | 346 |
| `personal_count`, `hedging_count`, `informal_count` | jumlah penanda berbeda, kata utuh | 347-349 |
| `causal_count`, `contrast_count` | jumlah kemunculan, dari tepi kiri kata, tanpa hitung ganda | 309 |
| `bloom_verb_hits[L]` | jumlah kata kerja `BLOOM_VERBS[L]` yang muncul | 335-338 |

## Skor AI heuristik E1 (`engines/ai_score.py`)

Setiap sinyal punya `value` 0-1 (tinggi = lebih mirip AI) dan bobot `TEXT_WEIGHTS` (`:59`, jumlah 1,0):

| | Sinyal | value | Netral 0,5 bila | Bobot | Baris |
|---|---|---|---|---|---|
| S1 | Keseragaman kalimat | `1 - burstiness / 0.6` | < 3 kalimat | 0,40 | 76-82 |
| S2 | Frasa formulaik | `llm_phrase_count / 4` | - | 0,25 | 101-103 |
| S3 | Ketiadaan suara personal | `1 - (personal + evidence) / 3` | - | 0,05 | 119-122 |
| S4 | Kepastian datar | `1 - (hedging + informal) / 3` | - | 0,05 | 136-139 |
| S5 | Keragaman kosakata | `abs(TTR - 0.62) / 0.25` | < 120 kata | 0,25 | 157-170 |

Semua `value` dijepit ke 0-1 (`_clamp01`). Skor akhir (`:241-242`):

```
skor = round( clamp01( Σ value_i × bobot_i ) × 100 )        kontribusi_i = value_i × bobot_i × 100
```

Band (`:187-196`): **< 42 rendah, 42-69 sedang, ≥ 70 tinggi**. Ambang Winston beda: **35/70**
(`providers/winston.py:39-40`). Bobot dan ambang 42 hasil grid search `ai_experiment/src/tune_weights.py`
pada gold set 999 sampel (FPR 0,044); ambang 70 belum terukur (skor gold set maksimum 68).

## Level Bloom heuristik E2 (`engines/bloom.py`)

Skor bukti per level (`_level_scores`, `:68-99`), `V[L]` = `bloom_verb_hits[L]`:

```
L1 = V1
L2 = V2 + 0,8 × explanatory + 0,3 × ordinal
L3 = V3 + 1,0 × procedural  + 0,2 × ordinal
L4 = V4 + 0,7 × causal      + 0,7 × contrast
L5 = V5 + 1,0 × evaluative        (× 0,4 bila causal = 0)
L6 = V6 + 1,2 × creative          (× 0,4 bila causal = 0 dan procedural = 0)
```

Penentuan level (`estimate_bloom_level`, `:158-186`):
1. Level = level **tertinggi** dengan skor ≥ `EVIDENCE_THRESHOLD` 2,0 (`:37`); tidak ada -> L1.
2. Dibatasi panjang (`LENGTH_CAPS`, `:23`): < 50 kata maks L1, < 90 L2, < 140 L3, < 200 L4, < 280 L5.
3. Kepadatan penanda per kata > 0,25 (daftar kata kunci) -> maks L2, keyakinan low (`:174`).
   Porsi kata fungsi Indonesia < 0,12 -> keyakinan low (`:178`).

Keyakinan (`_confidence`, `:102-113`): < 40 kata low; skor level terpilih ≥ 4 dan ≥ 120 kata high;
≥ 2 dan ≥ 50 kata medium; selainnya low. Groq menimpa level ini bila menjawab.

## Pola pengerjaan, bobot 0 (`engines/process_signals.py`)

`PROCESS_WEIGHT = 0.0` (`ai_score.py:69`): dilaporkan terpisah sebagai `process_band`, tidak menambah skor AI
(ambang 42 diukur pada teks saja; menulis di Word lalu menempel terlihat sama dengan menyalin).

- Dengan ≥ 4 cuplikan jumlah kata dari server (`MIN_SAMPLES`, `:23`): **lonjakan** = tambahan ≥ 60 kata
  antar cuplikan dengan laju ≥ 80 kata/menit (`:15-16`). `value = Σ kata lonjakan / kata akhir` (`:87-126`, `_growth_value`).
- Tanpa cuplikan: laju agregat, `value = (wpm - 25) / (80 - 25)` dijepit 0-1 (`_pace_value`, `:62-77`).
- Kata baru lewat revisi ≥ 60: `value = max(value, kata_baru / kata_akhir)` (`:139-143`).
- Band (`assess_process`, `:167`): **< 0,35 normal, 0,35-0,59 partial, ≥ 0,6 attention**; `unrecorded` bila tanpa dasar.

## Contoh hitung (dijalankan dengan fungsi asli)

Teks 94 kata, 8 kalimat tentang bubble sort vs merge sort, memuat "di era digital", "memainkan peran
penting", "menurut saya", "karena", "sehingga", "namun", "tetapi", "lebih efektif", "kelemahan".

Fitur: burstiness 0,23; TTR 0,766; llm_phrase 2; personal 2; evidence 0; hedging 0; informal 0;
causal 2; contrast 2; evaluative 3; V2 = 1 ("membandingkan"); V6 = 1 ("menggabungkan").

| Sinyal | value | × bobot | kontribusi |
|---|---|---|---|
| S1 | 1 - 0,23/0,6 = 0,617 | 0,40 | 24,7 |
| S2 | 2/4 = 0,5 | 0,25 | 12,5 |
| S3 | 1 - 2/3 = 0,333 | 0,05 | 1,7 |
| S4 | 1 - 0/3 = 1,0 | 0,05 | 5,0 |
| S5 | 94 < 120 kata -> 0,5 | 0,25 | 12,5 |

Skor = round(56,3) = **56 -> band sedang** (42 ≤ 56 < 70).

Bloom: L4 = 0,7×2 + 0,7×2 = 2,8; L5 = 1,0×3 = 3,0 (ada konektor sebab, tanpa penalti); L6 = 1,0; L2 = 1,0.
Level tertinggi ≥ 2,0 adalah **L5**, tetapi 94 kata < 140 -> **dibatasi L3**; skor L3 = 0 -> keyakinan **low**.

Proses: cuplikan (60 s, 20), (120 s, 40), (180 s, 60), (210 s, 300), (900 s, 300). Langkah +240 kata dalam
30 s = 480 kata/menit -> lonjakan; value = 240/300 = 0,8 -> **attention** (skor AI tetap 56).

Reproduksi: `cd backend && python manage.py shell` lalu `extract_features`, `score_ai_probability`,
`estimate_bloom_level`, `assess_process`.
