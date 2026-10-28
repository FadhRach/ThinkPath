# ASR Cek Paham pada FLEURS id_id (test, 100 klip)

## Hasil

| model | WER | CER | latensi median | RTF median | tunggu 60 dtk audio | tunggu 90 dtk audio |
|---|---|---|---|---|---|---|
| groq-turbo | 0.066 | 0.024 | 0.96 | 0.075 | 3.122 | 4.482 |
| groq-large-v3 | 0.061 | 0.02 | 1.048 | 0.082 | 3.78 | 5.426 |
| faster-whisper-small | 0.141 | 0.039 | 1.89 | 0.162 | 6.27 | 8.98 |

## Dilewati

- tidak ada

## Temuan

- WER terendah: groq-large-v3 (6.1%).
- Tercepat: groq-turbo (median 0.96 detik per klip).
- Model produksi saat ini adalah groq-turbo.

## Batasan

Ucapan dibacakan dan bersih, jadi WER jawaban spontan kemungkinan lebih tinggi. Waktu tunggu 60-90 detik adalah perkiraan.
