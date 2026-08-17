"""Bukti bahwa lapisan detektor eksternal bisa mati kapan saja tanpa merusak apa pun.

Detektor pihak ketiga memperkenalkan satu kelas kegagalan yang sebelumnya tidak
ada di produk ini: pihak luar yang bisa lambat, menolak, kehabisan saldo, atau
berubah kontrak tanpa memberi tahu. Berkas ini memastikan setiap kegagalan itu
berakhir di jalur cadangan, bukan di layar mahasiswa yang sedang mengumpulkan
tugas.

Tes terpenting di berkas ini adalah ScoreDirectionTest. Winston mengembalikan
"human score" yang arahnya berlawanan dengan skor yang dipakai produk ini.
Kalau pembalikannya hilang, mahasiswa yang menulis sendiri akan mendapat skor
AI tertinggi sementara yang menyalin ChatGPT lolos, dan angkanya tetap terlihat
masuk akal sehingga kesalahannya bisa berjalan berbulan bulan tanpa ketahuan.

Tidak ada satu pun tes di sini yang menyentuh jaringan.

Seluruh kelas memakai TestCase dan bukan SimpleTestCase karena jalur analisis
kini menyimpan skor detektor ke basis data agar tidak dibayar dua kali. Cache
itu juga alasan _analyse() mengosongkannya lebih dulu: sebagian besar tes di
sini sengaja menilai teks yang sama berkali kali dengan skor tiruan yang
berbeda, dan cache yang hidup akan mengembalikan skor pertama untuk semuanya
sehingga tesnya lulus tanpa menguji apa pun. Cache dibiarkan hidup hanya di
ScoreCacheTest, tempat perilakunya memang yang sedang diuji.
"""
from __future__ import annotations

from unittest.mock import patch

import requests
from django.db import DatabaseError
from django.test import TestCase

from academics import detector
from academics.llm import run_analysis
from academics.models import AnalysisSource, DetectorScore
from academics.process_signals import ProcessContext

# Winston menolak teks di bawah 300 karakter dan menyatakan hasilnya belum
# andal di bawah 600. Fixture ini sengaja melewati keduanya supaya jalur happy
# path benar benar terjalani.
ANSWER = (
    "Saya mencoba menguraikan kebijakan subsidi energi berdasarkan bacaan mata "
    "kuliah dan diskusi kelas. Subsidi menjaga daya beli rumah tangga "
    "berpendapatan rendah, tetapi distribusinya cenderung regresif karena "
    "konsumsi bahan bakar justru terkonsentrasi pada kelompok menengah atas. "
    "Akibatnya instrumen yang sama bisa menghasilkan efek yang berlawanan, "
    "tergantung bagaimana penyalurannya dirancang. Waktu praktikum simulasi "
    "kebijakan kemarin, kelompok saya mencoba menaikkan ambang penerima dan "
    "hasilnya justru memperlebar kesenjangan, sesuatu yang tidak kami duga "
    "sebelumnya. Menurut saya argumen yang menyerukan pencabutan total kurang "
    "tepat, karena mengabaikan kapasitas administratif daerah yang belum merata. "
    "Kelemahan analisis saya sendiri, datanya hanya dari satu simulasi, sehingga "
    "belum tentu berlaku untuk kasus lain."
)

PROCESS = ProcessContext(
    duration_seconds=1800,
    revision_count=2,
    word_count=len(ANSWER.split()),
    char_count=len(ANSWER),
)


class _Response:
    """Pengganti requests.Response seadanya, hanya yang dipakai klien."""

    def __init__(self, status_code: int = 200, payload: object = None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {"score": 50}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self) -> object:
        return self._payload


def _winston_says(human_score: float, **extra):
    """human_score memakai konvensi Winston: 100 manusia, 0 AI."""
    payload = {"score": human_score, **extra}
    return patch(
        "academics.detector.requests.post", return_value=_Response(payload=payload)
    )


def _with_key(**extra):
    """Detektor menyala, Groq mati. Groq mati membuat lapisan dasar heuristik.

    Dipakai di sebagian besar tes karena yang diuji adalah lapisan detektor,
    bukan Groq. Jalur Groq punya tesnya sendiri di test_analysis_decoupling.
    """
    env = {"WINSTON_API_KEY": "k" * 32, "GROQ_API_KEY": ""}
    env.update(extra)
    return patch.dict("os.environ", env)


def _analyse(process: ProcessContext | None = PROCESS, text: str = ANSWER) -> dict:
    """Analisis dengan cache dikosongkan lebih dulu. Lihat docstring modul."""
    DetectorScore.objects.all().delete()
    return run_analysis(text, "S1", 4, process)


class ScoreDirectionTest(TestCase):
    """Winston melaporkan keyakinan MANUSIA. Arahnya harus dibalik tepat sekali."""

    def test_human_score_100_means_no_ai_indication(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(100):
                self.assertEqual(detector.detect(ANSWER).ai_probability, 0.0)

    def test_human_score_0_means_maximum_ai_indication(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(0):
                self.assertEqual(detector.detect(ANSWER).ai_probability, 1.0)

    def test_midpoint_stays_at_midpoint(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(50):
                self.assertAlmostEqual(detector.detect(ANSWER).ai_probability, 0.5)

    def test_human_written_text_scores_lower_than_ai_written(self):
        """Uji arah dari ujung ke ujung, bukan hanya di dalam klien.

        Pembalikan yang benar di detector.py tetap bisa dibatalkan oleh
        pembalikan kedua di llm.py. Tes ini yang menangkapnya.
        """
        with _with_key(), _winston_says(95):
            looks_human = _analyse()
        with _with_key(), _winston_says(5):
            looks_ai = _analyse()
        self.assertLess(looks_human["ai_score"], looks_ai["ai_score"])


class DisabledByDefaultTest(TestCase):
    """Tanpa key, perilakunya harus persis seperti sebelum detektor ada."""

    def test_no_key_means_no_request_at_all(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "", "GROQ_API_KEY": ""}):
            with patch("academics.detector.requests.post") as post:
                result = _analyse()
        post.assert_not_called()
        self.assertEqual(result["analysis_source"], AnalysisSource.HEURISTIC)

    def test_detect_returns_none_without_key(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": ""}):
            self.assertIsNone(detector.detect(ANSWER))


class HappyPathTest(TestCase):
    def test_ai_looking_text_raises_ai_score(self):
        with _with_key(), _winston_says(8):
            result = _analyse()
        self.assertEqual(result["analysis_source"], AnalysisSource.DETECTOR)
        self.assertGreater(result["ai_score"], 50)

    def test_breakdown_names_detector_and_process_first(self):
        """Dua baris penyumbang skor di depan, baris pembanding di belakang."""
        with _with_key(), _winston_says(30):
            result = _analyse()
        keys = [row["key"] for row in result["signal_breakdown"]]
        self.assertEqual(keys[:2], ["external_detector", "process_forensics"])

    def test_evidence_records_provider_and_version(self):
        """analysis_source hanya mencatat "detector", jadi jejak auditnya di sini."""
        with _with_key(), _winston_says(30):
            result = _analyse()
        evidence = result["signal_breakdown"][0]["evidence"]
        self.assertIn(detector.PROVIDER_NAME, evidence)
        self.assertIn(detector.MODEL_VERSION, evidence)

    def test_contributions_reconstruct_the_score(self):
        """Panel "Asal Skor AI" tidak boleh berbohong soal asal angkanya."""
        with _with_key(), _winston_says(39):
            result = _analyse()
        total = sum(row["contribution"] for row in result["signal_breakdown"])
        self.assertAlmostEqual(total, result["ai_score"], delta=1.0)

    def test_weights_sum_to_one(self):
        with _with_key(), _winston_says(39):
            result = _analyse()
        total = sum(row["weight"] for row in result["signal_breakdown"])
        self.assertAlmostEqual(total, 1.0, places=4)

    def test_breakdown_present_even_without_process_metadata(self):
        """Angka tanpa alasannya adalah persis yang produk ini tolak."""
        with _with_key(), _winston_says(39):
            result = _analyse(process=None)
        self.assertEqual(result["signal_breakdown"][0]["key"], "external_detector")
        self.assertEqual(result["signal_breakdown"][0]["weight"], 1.0)
        self.assertEqual(result["ai_score"], 61)

    def test_prose_follows_the_number(self):
        """summary dan recommendation disusun ulang mengikuti band baru."""
        with _with_key(), _winston_says(1):
            high = _analyse()
        with _with_key(), _winston_says(100):
            low = _analyse()
        self.assertNotEqual(high["summary"], low["summary"])
        self.assertNotEqual(high["recommendation"], low["recommendation"])

    def test_never_claims_high_confidence(self):
        """Ketepatan detektor pada teks Indonesia belum pernah diukur.

        Menandai skornya "high" berarti mengklaim ketepatan yang belum pernah
        diuji, tepat di sebelah angka yang dibaca dosen sebelum memanggil
        mahasiswa.
        """
        for human_score in (0, 50, 100):
            with self.subTest(human_score=human_score):
                with _with_key(), _winston_says(human_score):
                    self.assertNotEqual(_analyse()["confidence"], "high")


class HeuristicContextRowsTest(TestCase):
    """Baris pembanding S1-S5 pada jalur detektor: tampil, tapi tidak menilai.

    Dosen ingin tetap bisa membedah gaya teks meski angkanya dari detektor.
    Yang dijaga di sini: baris tambahan itu TIDAK pernah menyumbang skor,
    karena detektor dan kelima sinyal membaca teks yang sama dan menjumlahkan
    keduanya berarti menghitung ganda bukti yang sama.
    """

    HEURISTIC_KEYS = {
        "uniformity",
        "formulaic_phrasing",
        "impersonality",
        "flat_certainty",
        "lexical_uniformity",
    }

    def test_detector_path_includes_all_five_context_rows(self):
        with _with_key(), _winston_says(30):
            result = _analyse()
        keys = {row["key"] for row in result["signal_breakdown"]}
        self.assertTrue(self.HEURISTIC_KEYS.issubset(keys))

    def test_context_rows_carry_zero_weight_and_zero_contribution(self):
        with _with_key(), _winston_says(30):
            result = _analyse()
        for row in result["signal_breakdown"]:
            if row["key"] in self.HEURISTIC_KEYS:
                with self.subTest(key=row["key"]):
                    self.assertEqual(row["weight"], 0.0)
                    self.assertEqual(row["contribution"], 0.0)

    def test_score_is_identical_with_and_without_context_rows(self):
        """Baris pembanding murni tampilan; angka akhirnya tidak boleh bergeser.

        Skor direkonstruksi dari baris berbobot saja dan harus tetap sama
        dengan ai_score, membuktikan baris nol benar benar menyumbang nol.
        """
        with _with_key(), _winston_says(39):
            result = _analyse()
        weighted_total = sum(
            row["contribution"] for row in result["signal_breakdown"]
        )
        self.assertAlmostEqual(weighted_total, result["ai_score"], delta=1.0)

    def test_heuristic_path_has_no_zero_weight_duplicates(self):
        """Jalur heuristik sudah menampilkan kelimanya sebagai penyumbang skor;
        menambahkan salinan berbobot nol akan menampilkan sinyal yang sama dua
        kali dengan dua angka bobot berbeda."""
        with patch.dict("os.environ", {"WINSTON_API_KEY": "", "GROQ_API_KEY": ""}):
            result = _analyse()
        self.assertEqual(result["analysis_source"], AnalysisSource.HEURISTIC)
        for row in result["signal_breakdown"]:
            with self.subTest(key=row["key"]):
                self.assertGreater(row["weight"], 0.0)


class LengthGuardTest(TestCase):
    """Batas panjang penyedia dijaga di sisi kita, bukan ditunggu ditolak."""

    def test_text_below_minimum_is_never_sent(self):
        """Kredit terpakai per kata, dan permintaan yang pasti ditolak tetap menunggu."""
        short = "Jawaban pendek." * 3
        self.assertLess(len(short), detector.MIN_CHARS)
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch("academics.detector.requests.post") as post:
                self.assertIsNone(detector.detect(short))
        post.assert_not_called()

    def test_text_above_maximum_is_never_sent(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch("academics.detector.requests.post") as post:
                self.assertIsNone(detector.detect("a" * (detector.MAX_CHARS + 1)))
        post.assert_not_called()

    def test_borderline_length_is_scored_but_flagged_unreliable(self):
        """Penyedia sendiri tidak percaya hasilnya di bawah ambang ini."""
        borderline = "a" * (detector.RELIABLE_MIN_CHARS - 1)
        self.assertGreater(len(borderline), detector.MIN_CHARS)
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(20):
                result = detector.detect(borderline)
        self.assertIsNotNone(result)
        self.assertFalse(result.reliable)

    def test_unreliable_result_forces_low_confidence(self):
        borderline = "kata " * 100  # 500 karakter, di atas 300 di bawah 600
        self.assertGreater(len(borderline), detector.MIN_CHARS)
        self.assertLess(len(borderline), detector.RELIABLE_MIN_CHARS)
        with _with_key(), _winston_says(10):
            result = run_analysis(borderline, "S1", 4, None)
        self.assertEqual(result["confidence"], "low")

    def test_unreliable_result_says_so_in_the_evidence(self):
        borderline = "kata " * 100
        with _with_key(), _winston_says(10):
            result = run_analysis(borderline, "S1", 4, None)
        self.assertIn("terlalu pendek", result["signal_breakdown"][0]["evidence"])


class EvasionTest(TestCase):
    """Karakter tak terlihat tidak punya penjelasan polos."""

    def test_attack_is_reported_as_written_evidence(self):
        with _with_key(), _winston_says(
            60, attack_detected={"zero_width_space": True, "homoglyph_attack": False}
        ):
            result = _analyse()
        self.assertIn("lebar nol", result["signal_breakdown"][0]["evidence"])

    def test_attack_is_surfaced_in_signals_list(self):
        with _with_key(), _winston_says(
            60, attack_detected={"zero_width_space": False, "homoglyph_attack": True}
        ):
            result = _analyse()
        self.assertTrue(
            any("karakter mirip" in signal for signal in result["signals"])
        )
        self.assertLessEqual(len(result["signals"]), 4)

    def test_attack_does_not_silently_change_the_number(self):
        """Menaikkan skor tanpa mengatakan alasannya persis yang produk ini tolak."""
        with _with_key(), _winston_says(60):
            clean = _analyse()
        with _with_key(), _winston_says(
            60, attack_detected={"zero_width_space": True, "homoglyph_attack": True}
        ):
            attacked = _analyse()
        self.assertEqual(clean["ai_score"], attacked["ai_score"])

    def test_missing_attack_field_is_not_an_error(self):
        with _with_key(), _winston_says(60):
            self.assertEqual(_analyse()["analysis_source"], AnalysisSource.DETECTOR)


class FallbackChainTest(TestCase):
    """Tiga lapis: detektor eksternal, lalu Groq, lalu heuristik."""

    def test_credits_exhausted_falls_through(self):
        with _with_key(), patch(
            "academics.detector.requests.post", return_value=_Response(status_code=402)
        ):
            result = _analyse()
        self.assertEqual(result["analysis_source"], AnalysisSource.HEURISTIC)

    def test_402_message_names_the_cause(self):
        """Kredit habis bukan bug yang perlu dicari, melainkan saldo yang perlu diisi."""
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(status_code=402),
            ):
                with self.assertLogs("academics.detector", level="WARNING") as logs:
                    self.assertIsNone(detector.detect(ANSWER))
        self.assertIn("402", "".join(logs.output))

    def test_rate_limit_falls_through(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(status_code=429),
            ):
                self.assertIsNone(detector.detect(ANSWER))

    def test_timeout_falls_through(self):
        with _with_key(), patch(
            "academics.detector.requests.post",
            side_effect=requests.Timeout("terlalu lama"),
        ):
            result = _analyse()
        self.assertEqual(result["analysis_source"], AnalysisSource.HEURISTIC)

    def test_connection_error_falls_through(self):
        with _with_key(), patch(
            "academics.detector.requests.post",
            side_effect=requests.ConnectionError("mati"),
        ):
            result = _analyse()
        self.assertEqual(result["analysis_source"], AnalysisSource.HEURISTIC)

    def test_broken_payload_falls_through(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(payload={"tidak_ada_score": 1}),
            ):
                self.assertIsNone(detector.detect(ANSWER))

    def test_score_outside_contract_falls_through(self):
        """Skor di luar 0..100 berarti kontraknya berubah, dan itu tidak boleh dijepit."""
        for bad in (-1, 101):
            with self.subTest(score=bad):
                with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
                    with _winston_says(bad):
                        self.assertIsNone(detector.detect(ANSWER))

    def test_non_numeric_score_falls_through(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says("tinggi"):
                self.assertIsNone(detector.detect(ANSWER))

    def test_server_error_falls_through(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(status_code=500),
            ):
                self.assertIsNone(detector.detect(ANSWER))


class RequestShapeTest(TestCase):
    def test_language_is_pinned_to_indonesian(self):
        """Deteksi otomatis pada teks campuran Indonesia-Inggris bisa memilih en."""
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(payload={"score": 50}),
            ) as post:
                detector.detect(ANSWER)
        self.assertEqual(post.call_args.kwargs["json"]["language"], "id")

    def test_model_version_is_pinned(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(payload={"score": 50}),
            ) as post:
                detector.detect(ANSWER)
        self.assertEqual(
            post.call_args.kwargs["json"]["version"], detector.MODEL_VERSION
        )

    def test_key_travels_in_the_header_not_the_body(self):
        """Pesan galat requests memuat URL, bukan body. Kunci tidak boleh bocor ke log."""
        with patch.dict("os.environ", {"WINSTON_API_KEY": "rahasia" * 4}):
            with patch(
                "academics.detector.requests.post",
                return_value=_Response(payload={"score": 50}),
            ) as post:
                detector.detect(ANSWER)
        self.assertNotIn("key", post.call_args.kwargs["json"])
        self.assertIn("rahasia", post.call_args.kwargs["headers"]["Authorization"])


class DecouplingSurvivesDetectorTest(TestCase):
    """Aturan paling penting produk ini tidak boleh goyah karena detektor baru."""

    def test_detector_score_never_moves_bloom_level(self):
        levels = set()
        for human_score in (0, 25, 50, 75, 100):
            with _with_key(), _winston_says(human_score):
                levels.add(_analyse()["bloom_level"])
        self.assertEqual(
            len(levels),
            1,
            f"level Bloom ikut bergerak mengikuti skor detektor: {levels}",
        )

    def test_detector_score_never_moves_bloom_confidence(self):
        confidences = set()
        for human_score in (0, 50, 100):
            with _with_key(), _winston_says(human_score):
                confidences.add(_analyse()["bloom_confidence"])
        self.assertEqual(len(confidences), 1)

    def test_output_contract_is_unchanged(self):
        """Bentuk dict harus tetap cocok sebagai kwargs AnalysisResult."""
        with _with_key(), _winston_says(50):
            with_detector = _analyse()
        with patch.dict("os.environ", {"WINSTON_API_KEY": "", "GROQ_API_KEY": ""}):
            without = _analyse()
        self.assertEqual(set(with_detector), set(without))


class CreditWarningTest(TestCase):
    """Kredit habis harus terbaca sebelum kejadian, bukan sesudahnya.

    Tanpa peringatan ini, satu satunya tanda saldo habis adalah 402 yang muncul
    mendadak, dan sejak itu setiap submission diam diam turun ke jalur cadangan
    sampai ada yang kebetulan memeriksa log.
    """

    def test_low_balance_is_logged(self):
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(50, credits_remaining=79):
                with self.assertLogs("academics.detector", level="WARNING") as logs:
                    self.assertIsNotNone(detector.detect(ANSWER))
        self.assertIn("79", "".join(logs.output))

    def test_healthy_balance_stays_quiet(self):
        """Log yang berisik saat semuanya normal membuat log penting ikut terabaikan."""
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(50, credits_remaining=500_000):
                with patch.object(detector.logger, "warning") as warn:
                    detector.detect(ANSWER)
        warn.assert_not_called()

    def test_missing_credit_field_is_not_an_error(self):
        """Penyedia boleh saja berhenti mengirim field ini."""
        with patch.dict("os.environ", {"WINSTON_API_KEY": "k" * 32}):
            with _winston_says(50):
                self.assertIsNotNone(detector.detect(ANSWER))


class ScoreCacheTest(TestCase):
    """Satu satunya kelas yang membiarkan cache hidup, karena inilah yang diuji.

    Penyedia menagih per KATA, bukan per permintaan, dan sisa kreditnya tinggal
    beberapa esai. Tanpa cache, setiap penekanan Analisis Ulang pada jawaban
    yang teksnya tidak berubah membayar penuh lagi untuk teks yang sama - dan
    dosen menekan tombol itu justru ketika ia ragu pada angkanya.
    """

    def test_same_text_is_paid_for_only_once(self):
        with _with_key(), _winston_says(30) as post:
            first = run_analysis(ANSWER, "S1", 4, PROCESS)
            second = run_analysis(ANSWER, "S1", 4, PROCESS)
        self.assertEqual(post.call_count, 1)
        self.assertEqual(first["ai_score"], second["ai_score"])
        self.assertEqual(second["analysis_source"], AnalysisSource.DETECTOR)

    def test_reanalyzing_an_unchanged_answer_costs_nothing(self):
        """Jalur yang menjadi alasan seluruh fitur ini ada.

        SubmissionReanalyzeView memanggil run_analysis dengan teks yang persis
        sama seperti saat submission dibuat. Panggilan kedua harus gratis.
        """
        with _with_key(), _winston_says(30) as post:
            run_analysis(ANSWER, "S1", 4, PROCESS)
            post.reset_mock()
            run_analysis(ANSWER, "S1", 4, PROCESS)
        post.assert_not_called()

    def test_revised_answer_is_scored_again(self):
        """Teks yang berubah adalah teks baru, dan memang harus dibayar lagi."""
        revised = ANSWER + " Setelah revisi saya menambahkan satu paragraf lagi."
        with _with_key(), _winston_says(30) as post:
            run_analysis(ANSWER, "S1", 4, PROCESS)
            run_analysis(revised, "S1", 4, PROCESS)
        self.assertEqual(post.call_count, 2)

    def test_new_model_version_invalidates_the_cache(self):
        """Skor lama berasal dari model lain dan tidak boleh dipakai ulang.

        detector.py sengaja memaku MODEL_VERSION supaya skor yang tersimpan
        hari ini masih bisa dijelaskan berbulan kemudian. Versi ikut menjadi
        kunci cache supaya menaikkannya otomatis membatalkan skor lama, tanpa
        ada yang perlu ingat menghapusnya.
        """
        with _with_key(), _winston_says(30) as post:
            run_analysis(ANSWER, "S1", 4, PROCESS)
            with patch.object(detector, "MODEL_VERSION", "9.99"):
                run_analysis(ANSWER, "S1", 4, PROCESS)
        self.assertEqual(post.call_count, 2)

    def test_cache_stores_ai_probability_not_the_raw_human_score(self):
        """Konvensi arah dikunci di sini.

        Kalau suatu saat ada yang menyimpan human score mentah ke kolom yang
        sama, seluruh baris lama terbaca terbalik tanpa gejala apa pun: angkanya
        tetap masuk akal, hanya menuduh orang yang salah.
        """
        with _with_key(), _winston_says(90):
            run_analysis(ANSWER, "S1", 4, PROCESS)
        row = DetectorScore.objects.get()
        self.assertAlmostEqual(row.ai_probability, 0.10, places=6)

    def test_cache_never_stores_the_answer_text(self):
        """Jawabannya sudah ada di Submission. Menyalinnya menggandakan data pribadi."""
        with _with_key(), _winston_says(30):
            run_analysis(ANSWER, "S1", 4, PROCESS)
        row = DetectorScore.objects.get()
        stored = " ".join(
            str(value) for value in row.__dict__.values() if isinstance(value, str)
        )
        self.assertNotIn("subsidi energi", stored)
        self.assertEqual(len(row.text_hash), 64)

    def test_failures_are_never_cached(self):
        """402 dan 429 bersifat sementara.

        Menyimpan "tidak ada hasil" akan membekukan submission itu di jalur
        cadangan selamanya, bahkan setelah saldo diisi, dan tidak akan ada yang
        menyadarinya karena sistem memang dirancang tenang saat detektor gagal.
        """
        with _with_key(), patch(
            "academics.detector.requests.post", return_value=_Response(status_code=402)
        ):
            gagal = run_analysis(ANSWER, "S1", 4, PROCESS)
        self.assertEqual(gagal["analysis_source"], AnalysisSource.HEURISTIC)
        self.assertEqual(DetectorScore.objects.count(), 0)

        with _with_key(), _winston_says(30):
            pulih = run_analysis(ANSWER, "S1", 4, PROCESS)
        self.assertEqual(pulih["analysis_source"], AnalysisSource.DETECTOR)

    def test_attack_flags_survive_the_round_trip(self):
        """Bukti pengelabuan tidak boleh hilang hanya karena skornya dari cache."""
        with _with_key(), _winston_says(
            60, attack_detected={"zero_width_space": True, "homoglyph_attack": False}
        ):
            run_analysis(ANSWER, "S1", 4, PROCESS)
            from_cache = run_analysis(ANSWER, "S1", 4, PROCESS)
        self.assertTrue(
            any("lebar nol" in signal for signal in from_cache["signals"])
        )

    def test_broken_cache_table_never_blocks_a_submission(self):
        """Tabel cache yang bermasalah boleh memboroskan kredit, tidak boleh menggagalkan tugas."""
        with _with_key(), _winston_says(30), patch(
            "academics.detector_cache._lookup", side_effect=DatabaseError("tabel rusak")
        ), patch(
            "academics.detector_cache._store", side_effect=DatabaseError("tabel rusak")
        ):
            result = run_analysis(ANSWER, "S1", 4, PROCESS)
        self.assertEqual(result["analysis_source"], AnalysisSource.DETECTOR)


class BandThresholdTest(TestCase):
    def test_bands_are_owned_by_this_module(self):
        """Ambang detektor harus bisa digeser tanpa menggeser ambang heuristik."""
        from academics import ai_score

        self.assertIsNot(detector.score_to_band, ai_score.score_to_band)

    def test_band_boundaries(self):
        self.assertEqual(detector.score_to_band(detector.MID_THRESHOLD - 1), "low")
        self.assertEqual(detector.score_to_band(detector.MID_THRESHOLD), "mid")
        self.assertEqual(detector.score_to_band(detector.HIGH_THRESHOLD - 1), "mid")
        self.assertEqual(detector.score_to_band(detector.HIGH_THRESHOLD), "high")
