"""Batas ukuran jawaban; dipakai serializer dan layanan pengumpulan."""

# ±3.000 kata. Esai kuliah wajar jauh di bawah ini; batas atas mencegah satu
# permintaan membakar kuota Winston/Groq dan memenuhi memori analisis.
MAX_ANSWER_CHARS = 20_000

# Jawaban minimal sekian kata sebelum boleh dikumpulkan (draf tidak dibatasi).
MIN_ANSWER_WORDS = 5
