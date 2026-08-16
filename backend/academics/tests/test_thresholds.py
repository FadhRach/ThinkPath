"""Ambang band adalah angka yang paling mudah tergeser diam diam, dan paling mahal kalau salah.

Ambang menentukan apakah seorang mahasiswa muncul di layar dosen sebagai perlu
ditanya atau tidak. Sebelum berkas ini ada, tidak satu pun tes menjaganya:
mengetik angka lain akan lolos seluruh rangkaian tes tanpa gejala, dan
akibatnya baru terlihat sebagai lonjakan tuduhan yang tidak ada yang bisa
jelaskan asalnya.

Dua hal yang dijaga di sini, dan keduanya lahir dari kesalahan yang pernah
terjadi:

1. **Ambang heuristik adalah hasil ukur, bukan karangan.** Nilainya harus tetap
   sama dengan yang dilaporkan ai_experiment/src/evaluate_baseline.py.
2. **Ambang heuristik dan ambang detektor tidak boleh saling meminjam.** Kedua
   sebaran skor bentuknya berbeda, dan ambang pinjaman terdengar masuk akal
   sambil menyesatkan tanpa suara.
"""
from __future__ import annotations

from django.test import SimpleTestCase

from academics import ai_score, detector
from academics.models import AiBand


class HeuristicThresholdTest(SimpleTestCase):
    """Angka 42 berasal dari pengukuran, dan tes ini yang menahannya di sana."""

    def test_mid_threshold_is_the_measured_value(self):
        """42 = ambang terendah yang menjaga FPR di bawah 5 persen.

        Diturunkan BERSAMA bobot terukur di TEXT_WEIGHTS (tune_weights.py):
        FPR 0,044 pada gold set 999 sampel, yaitu 22 dari 500 tulisan manusia,
        recall 0,607. Riwayat: 35 asli adalah karangan (FPR 0,838), 56 adalah
        ambang terukur untuk bobot lama. Kalau angka ini berubah, yang berubah
        adalah berapa banyak mahasiswa jujur yang tertuduh, jadi perubahannya
        harus disengaja dan disertai pengukuran baru.
        """
        self.assertEqual(ai_score.MID_THRESHOLD, 42)

    def test_high_threshold_is_still_unmeasured_and_left_alone(self):
        """Tidak ada satu pun sampel gold set yang mencapai 70.

        Berlaku juga dengan bobot baru (skor maksimum 68). Band tinggi praktis
        tidak pernah aktif, dan itu lebih baik daripada band tinggi yang aktif
        berdasarkan angka karangan.
        """
        self.assertEqual(ai_score.HIGH_THRESHOLD, 70)

    def test_band_boundaries_follow_the_constants(self):
        self.assertEqual(
            ai_score.score_to_band(ai_score.MID_THRESHOLD - 1), AiBand.LOW
        )
        self.assertEqual(ai_score.score_to_band(ai_score.MID_THRESHOLD), AiBand.MID)
        self.assertEqual(
            ai_score.score_to_band(ai_score.HIGH_THRESHOLD - 1), AiBand.MID
        )
        self.assertEqual(ai_score.score_to_band(ai_score.HIGH_THRESHOLD), AiBand.HIGH)

    def test_a_score_that_used_to_accuse_no_longer_does(self):
        """Bukti bahwa pergeserannya benar benar sampai ke keluaran.

        Skor 40 pada ambang asli 35 masuk band sedang dan muncul sebagai perlu
        ditanya. Sekarang ia band rendah. Inilah perubahan yang berkas ini jaga.
        """
        self.assertEqual(ai_score.score_to_band(40), AiBand.LOW)


class ThresholdsStayIndependentTest(SimpleTestCase):
    """Detektor eksternal punya sebaran skor sendiri, jadi ambangnya sendiri juga."""

    def test_detector_keeps_its_own_functions(self):
        self.assertIsNot(detector.score_to_band, ai_score.score_to_band)

    def test_detector_threshold_was_not_dragged_along(self):
        """Menggeser ambang heuristik TIDAK boleh ikut menggeser ambang detektor.

        Angka 42 diukur pada sebaran skor ensemble heuristik berbobot baru.
        Sebaran skor detektor terlatih bentuknya sama sekali berbeda, dan belum
        pernah diukur sama sekali. Menyalin angka heuristik ke sana adalah
        persis kesalahan yang diperingatkan di README: ambang pinjaman
        terdengar masuk akal dan menyesatkan tanpa suara.
        """
        self.assertNotEqual(detector.MID_THRESHOLD, ai_score.MID_THRESHOLD)
