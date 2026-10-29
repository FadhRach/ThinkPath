# ASR Cek Paham pada FLEURS id_id (test, 687 klip)

## Hasil

| model | WER | CER | latensi median | RTF median | tunggu 60 dtk audio | tunggu 90 dtk audio |
|---|---|---|---|---|---|---|
| groq-turbo | 0.071 | 0.023 | 0.868 | 0.069 | 3.07 | 4.456 |
| groq-large-v3 | 0.063 | 0.02 | 1.092 | 0.089 | 4.981 | 7.289 |
| faster-whisper-small | 0.161 | 0.046 | 2.283 | 0.195 | 6.999 | 9.9 |

## Dilewati

- tidak ada

## Temuan

- WER terendah: groq-large-v3 (6.3%).
- Tercepat: groq-turbo (median 0.87 detik per klip).
- Model produksi saat ini adalah groq-turbo.

## Batasan

Ucapan dibacakan dan bersih, jadi WER jawaban spontan kemungkinan lebih tinggi. Waktu tunggu 60-90 detik adalah perkiraan.
