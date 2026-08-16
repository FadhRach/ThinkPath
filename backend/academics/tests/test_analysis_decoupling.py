"""Bukti bahwa E1 dan E2 saling bebas.

Berkas ini adalah pengaman regresi untuk cacat yang diperbaiki di branch
fix/decouple-bloom-from-ai-score. Sebelumnya bloom_level dihitung dari ai_band
dan expected_bloom_level lewat fungsi band_to_bloom(), sehingga level kognitif
sepenuhnya ditentukan oleh dugaan kecurangan dan target dosen, tanpa pernah
membaca isi jawaban.

Kalau ada yang menyambungkan kembali kedua jalur itu di kemudian hari, tes di
berkas ini yang akan gagal lebih dulu.
"""
from __future__ import annotations

import ast
import inspect
from pathlib import Path

from django.test import SimpleTestCase

from academics import ai_score as ai_score_module
from academics import bloom as bloom_module
from academics import detector as detector_module
from academics.ai_score import (
    PROCESS_WEIGHT,
    TEXT_WEIGHTS,
    score_ai_probability,
    score_to_band,
)
from academics.analysis import analyze_text
from academics.bloom import estimate_bloom_level
from academics.models import AiBand, AnalysisSource, Confidence
from academics.process_signals import ProcessContext
from academics.text_features import extract_features

# Keempat contoh ditulis dalam register akademik mahasiswa, bukan register anak
# sekolah. Populasi sasaran produk berubah, jadi fixture harus ikut berubah:
# menguji detektor mahasiswa dengan tulisan berisi "gak" dan "banget" akan
# memberi rasa aman yang palsu.

# Dangkal: mendaftar ulang isi bacaan tanpa penalaran. Suara manusia hadir lewat
# keraguan dan rujukan ke mata kuliah.
SHALLOW_HUMAN = (
    "Sejauh ini yang saya pahami dari materi kebijakan subsidi energi ada beberapa "
    "bagian. Pertama soal definisinya, lalu jenis jenisnya, kemudian siapa saja yang "
    "menerimanya. Di slide mata kuliah kemarin disebutkan juga ada dampak fiskalnya. "
    "Harus diakui saya belum sepenuhnya paham bagian terakhir itu, jadi saya tuliskan "
    "kembali yang sempat saya catat. Belum jelas bagi saya bagaimana ketiganya "
    "berhubungan satu sama lain."
)

# Mendalam dengan suara manusia yang sama: sebab akibat, pembandingan, dan
# penilaian yang disertai alasan, ditambah keraguan yang wajar.
DEEP_HUMAN = (
    "Saya mencoba menguraikan kebijakan subsidi energi berdasarkan bacaan mata "
    "kuliah dan diskusi kelas. Subsidi menjaga daya beli rumah tangga berpendapatan "
    "rendah, tetapi distribusinya cenderung regresif karena konsumsi bahan bakar "
    "justru terkonsentrasi pada kelompok menengah atas. Akibatnya instrumen yang "
    "sama bisa menghasilkan efek yang berlawanan, tergantung bagaimana penyalurannya "
    "dirancang. Waktu praktikum simulasi kebijakan kemarin, kelompok saya mencoba "
    "menaikkan ambang penerima dan hasilnya justru memperlebar kesenjangan, sesuatu "
    "yang tidak kami duga sebelumnya. Ini berbeda dengan asumsi awal saya bahwa "
    "penargetan selalu memperbaiki keadaan. Setidaknya pada simulasi itu, kualitas "
    "basis data penerima tampaknya lebih menentukan daripada besaran subsidinya. "
    "Menurut saya argumen yang menyerukan pencabutan total kurang tepat, karena "
    "mengabaikan kapasitas administratif daerah yang belum merata. Sebaiknya "
    "pembahasan diarahkan ke perbaikan basis data lebih dulu. Kelemahan analisis "
    "saya sendiri, datanya hanya dari satu simulasi, sehingga belum tentu berlaku "
    "untuk kasus lain. Masih perlu pembanding dari daerah dengan kapasitas berbeda "
    "sebelum kesimpulan ini bisa dipegang."
)

# Gaya formulaik khas LLM, tetapi isinya tetap menunjukkan penalaran kuat.
# Perhatikan: tidak ada keraguan, tidak ada rujukan konkret, tidak ada pendirian
# yang bisa salah.
DEEP_FORMULAIC = (
    "Secara fundamental, kebijakan subsidi energi dapat dikonseptualisasikan "
    "sebagai mekanisme redistribusi sumber daya. Komponen fiskal menentukan "
    "keluaran komponen distribusi, sehingga urutan perumusan memainkan peran "
    "penting. Namun demikian, terdapat perbedaan mendasar apabila dibandingkan "
    "dengan pendekatan konvensional. Pendekatan konvensional mengasumsikan "
    "independensi antarvariabel, sedangkan pendekatan kontemporer menekankan "
    "keterkaitan struktural. Perbedaan asumsi tersebut menyebabkan implikasi "
    "metodologis yang berbeda pula. Ditinjau dari efektivitasnya, pendekatan "
    "kontemporer lebih efektif untuk kasus kompleks. Kelebihan utamanya terletak "
    "pada akurasi prediksi, sementara kekurangannya adalah kebutuhan data yang "
    "lebih besar. Analisis komparatif menunjukkan bahwa desain penyaluran "
    "menentukan hasil akhir kebijakan. Evaluasi terhadap kedua pendekatan "
    "memperlihatkan bahwa pemilihan instrumen seharusnya mempertimbangkan "
    "ketersediaan sumber daya administratif. Implikasi tersebut berlaku pada "
    "berbagai konteks penerapan kebijakan publik. Pertimbangan tersebut menjadi "
    "dasar perumusan rekomendasi yang lebih tepat sasaran. Kerangka analitis "
    "tersebut memungkinkan pemetaan hubungan antarvariabel secara sistematis. "
    "Pemetaan tersebut menghasilkan pemahaman yang lebih utuh terhadap "
    "mekanisme kebijakan yang dijalankan pemerintah."
)

# Gaya formulaik yang sama, tetapi isinya hanya menyebutkan. Kalimatnya
# sengaja hampir sama panjang dan kosakatanya berulang, supaya teks ini tetap
# menembus band tinggi pada bobot terukur (uniformity dan lexical_uniformity
# kini memikul 0,65 bobot teks).
SHALLOW_FORMULAIC = (
    "Di era modern ini, kebijakan subsidi energi memainkan peran penting. "
    "Secara fundamental, kebijakan subsidi energi melibatkan beberapa komponen utama. "
    "Dalam konteks ini, komponen fiskal memainkan peran yang sangat penting. "
    "Dalam konteks ini, komponen distribusi juga memainkan peran yang penting. "
    "Secara umum, komponen administratif memainkan peran yang tidak kalah penting. "
    "Masing masing komponen memiliki definisi dan karakteristik yang tersendiri. "
    "Secara keseluruhan, komponen tersebut saling berkontribusi secara holistik. "
    "Uraian tersebut memperlihatkan struktur kebijakan subsidi yang sangat kompleks."
)


def _code_identifiers(module) -> set[str]:
    """Semua nama yang benar benar dipakai kode di satu modul.

    Sengaja lewat AST, bukan pencarian teks biasa: docstring dan komentar harus
    diabaikan. Modul boleh saja menulis kalimat "tidak membaca level Bloom"
    tanpa itu dihitung sebagai ketergantungan.
    """
    tree = ast.parse(Path(inspect.getfile(module)).read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.add(node.module or "")
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
    return {name.lower() for name in names}


def _bloom_of(text: str) -> int:
    return estimate_bloom_level(extract_features(text)).level


def _ai_of(text: str) -> int:
    return score_ai_probability(extract_features(text)).score


class TargetDoesNotDetermineBloomTest(SimpleTestCase):
    """Target dosen tidak boleh mempengaruhi level yang diukur."""

    def test_bloom_level_identical_across_every_target(self):
        levels = {
            target: analyze_text(DEEP_HUMAN, target)["bloom_level"]
            for target in range(1, 7)
        }
        self.assertEqual(
            len(set(levels.values())),
            1,
            f"bloom_level berubah mengikuti target dosen: {levels}",
        )

    def test_ai_score_identical_across_every_target(self):
        scores = {
            target: analyze_text(DEEP_HUMAN, target)["ai_score"]
            for target in range(1, 7)
        }
        self.assertEqual(len(set(scores.values())), 1, f"ai_score ikut target: {scores}")

    def test_answer_can_exceed_teacher_target(self):
        """Dulu bloom_level dibatasi min(6, expected), jadi tidak pernah bisa
        melampaui target. Dosen karena itu tidak pernah tahu ada mahasiswa yang siap
        diberi tantangan lebih tinggi."""
        result = analyze_text(DEEP_HUMAN, expected_bloom_level=1)
        self.assertGreater(
            result["bloom_level"],
            1,
            "jawaban dengan penalaran kuat tetap tertahan di target dosen",
        )


class ScoresAreIndependentTest(SimpleTestCase):
    """Skor AI dan level Bloom harus bisa bergerak sendiri sendiri."""

    def test_same_writing_style_different_depth_gives_different_bloom(self):
        """Dua teks dengan gaya tulis sama informalnya, kedalaman berbeda."""
        self.assertLess(_bloom_of(SHALLOW_HUMAN), _bloom_of(DEEP_HUMAN))

    def test_same_depth_different_style_gives_different_ai_score(self):
        """Dua teks sama sama menunjukkan penalaran, gaya tulis berbeda."""
        self.assertLess(_ai_of(DEEP_HUMAN), _ai_of(DEEP_FORMULAIC))

    def test_all_four_combinations_are_reachable(self):
        """Empat kuadran harus bisa muncul.

        Pada kode lama hanya diagonal yang mungkin: band rendah selalu berarti
        Bloom tinggi dan sebaliknya. Korelasinya sempurna negatif secara
        konstruksi, sehingga salah satu dari dua angka di dashboard tidak
        membawa informasi tambahan apa pun.
        """
        quadrants = {
            (score_to_band(_ai_of(text)) == AiBand.HIGH, _bloom_of(text) >= 4)
            for text in (SHALLOW_HUMAN, DEEP_HUMAN, DEEP_FORMULAIC, SHALLOW_FORMULAIC)
        }
        self.assertEqual(
            len(quadrants),
            4,
            f"tidak semua kombinasi gaya dan kedalaman bisa muncul: {quadrants}",
        )


class NoCircularImportTest(SimpleTestCase):
    """Pengaman struktural, bukan sekadar pengaman perilaku.

    Selama bloom.py tidak menyebut ai_score dan sebaliknya, mustahil salah satu
    dipakai sebagai masukan bagi yang lain.
    """

    def test_bloom_module_never_references_ai_score(self):
        offenders = {
            name
            for name in _code_identifiers(bloom_module)
            if "ai_score" in name or "aiband" in name or "ai_band" in name
        }
        self.assertEqual(offenders, set(), f"bloom.py menyentuh E1 lewat: {offenders}")

    def test_ai_score_module_never_references_bloom(self):
        offenders = {
            name for name in _code_identifiers(ai_score_module) if "bloom" in name
        }
        self.assertEqual(offenders, set(), f"ai_score.py menyentuh E2 lewat: {offenders}")

    def test_detector_module_never_references_bloom(self):
        """Detektor eksternal masuk lewat E1, jadi ia tunduk pada aturan yang sama.

        Detektor hanya memberi skor AI. Kalau suatu saat ada yang tergoda
        memakai keluarannya untuk menaksir level kognitif, tes ini yang gagal
        lebih dulu.
        """
        offenders = {
            name for name in _code_identifiers(detector_module) if "bloom" in name
        }
        self.assertEqual(
            offenders, set(), f"detector.py menyentuh E2 lewat: {offenders}"
        )

    def test_band_to_bloom_no_longer_exists(self):
        from academics import analysis

        self.assertFalse(
            hasattr(analysis, "band_to_bloom"),
            "band_to_bloom() adalah sumber cacat melingkar dan tidak boleh kembali",
        )


class OutputContractTest(SimpleTestCase):
    """Bentuk keluaran harus tetap cocok sebagai kwargs AnalysisResult."""

    REQUIRED_KEYS = {
        "ai_score",
        "ai_band",
        "bloom_level",
        "confidence",
        "bloom_confidence",
        "signals",
        "signal_breakdown",
        "summary",
        "recommendation",
        "analysis_source",
    }

    def test_returns_every_required_key(self):
        self.assertEqual(set(analyze_text(DEEP_HUMAN, 4)), self.REQUIRED_KEYS)

    def test_values_stay_inside_model_validators(self):
        for text in (SHALLOW_HUMAN, DEEP_HUMAN, DEEP_FORMULAIC, SHALLOW_FORMULAIC):
            result = analyze_text(text, 4)
            self.assertGreaterEqual(result["ai_score"], 0)
            self.assertLessEqual(result["ai_score"], 100)
            self.assertIn(result["bloom_level"], range(1, 7))
            self.assertIn(result["ai_band"], AiBand.values)
            self.assertIn(result["confidence"], Confidence.values)
            self.assertIn(result["bloom_confidence"], Confidence.values)
            self.assertLessEqual(len(result["signals"]), 4)

    def test_heuristic_path_is_labelled_as_heuristic(self):
        """Hasil heuristik tidak boleh tersimpan menyamar sebagai hasil LLM."""
        result = analyze_text(DEEP_HUMAN, 4)
        self.assertEqual(result["analysis_source"], AnalysisSource.HEURISTIC)

    def test_heuristic_never_claims_high_confidence(self):
        for text in (SHALLOW_HUMAN, DEEP_HUMAN, DEEP_FORMULAIC, SHALLOW_FORMULAIC):
            self.assertNotEqual(analyze_text(text, 4)["confidence"], Confidence.HIGH)


class SignalBreakdownTest(SimpleTestCase):
    def test_text_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(TEXT_WEIGHTS.values()), 1.0, places=6)

    def test_breakdown_covers_every_weighted_signal(self):
        result = score_ai_probability(extract_features(DEEP_FORMULAIC))
        self.assertEqual({s.key for s in result.breakdown}, set(TEXT_WEIGHTS))

    def test_contributions_reconstruct_the_score(self):
        """Skor harus benar benar merupakan jumlah kontribusi yang ditampilkan.

        Kalau tidak, rincian yang dilihat dosen bukan penjelasan skor melainkan
        hiasan.
        """
        result = score_ai_probability(extract_features(DEEP_FORMULAIC))
        total = sum(signal.contribution for signal in result.breakdown)
        self.assertAlmostEqual(total, result.score, delta=1.0)


# Pengerjaan wajar: 260 kata dalam 35 menit, banyak revisi, tanpa tempelan.
PATIENT_PROCESS = ProcessContext(
    duration_seconds=35 * 60,
    revision_count=5,
    word_count=260,
    char_count=1600,
    paste_char_count=0,
)

# Pola pada contoh desain: 412 kata dalam 4 menit, tanpa revisi, ada tempelan.
RUSHED_PROCESS = ProcessContext(
    duration_seconds=4 * 60,
    revision_count=0,
    word_count=412,
    char_count=2500,
    paste_char_count=1400,
)


class FlatCertaintySignalTest(SimpleTestCase):
    """Sinyal pengganti mechanical_polish, inti dari pemindahan fokus ke mahasiswa.

    Sinyal lama menghitung ragam informal seperti "gak" dan "banget". Mahasiswa
    yang menulis esai akademik tidak pernah memakainya, sehingga nilainya
    konstan 1.0 untuk seluruh populasi: menyumbang bobot ke setiap orang tanpa
    membedakan siapa pun, dan ikut menaikkan skor mahasiswa jujur.
    """

    @staticmethod
    def _value(text: str) -> float:
        result = score_ai_probability(extract_features(text))
        return next(s for s in result.breakdown if s.key == "flat_certainty").value

    def test_hedging_lowers_the_signal(self):
        """Penulis yang ragu dan memberi syarat terbaca sebagai manusia."""
        self.assertLess(self._value(DEEP_HUMAN), self._value(DEEP_FORMULAIC))

    def test_not_constant_across_the_population(self):
        """Pengaman utama berkas ini.

        Kalau sinyal ini kembali bernilai sama untuk semua teks mahasiswa, ia
        mati lagi seperti pendahulunya, dan tes ini yang gagal lebih dulu.
        """
        values = {
            self._value(text)
            for text in (
                SHALLOW_HUMAN,
                DEEP_HUMAN,
                DEEP_FORMULAIC,
                SHALLOW_FORMULAIC,
            )
        }
        self.assertGreater(
            len(values),
            1,
            f"flat_certainty konstan di seluruh fixture: {values}",
        )

    def test_academic_register_is_not_punished_by_itself(self):
        """Ragam baku tanpa satu pun kata informal tidak otomatis mentok 1.0.

        Inilah bug yang membuat esai akademik tulisan manusia sebelumnya
        mendapat skor tinggi dan tertuduh.
        """
        features = extract_features(DEEP_HUMAN)
        self.assertEqual(features.informal_count, 0)
        self.assertGreater(features.hedging_count, 0)
        self.assertLess(self._value(DEEP_HUMAN), 1.0)


class WordBoundaryMatchingTest(SimpleTestCase):
    """Penanda kata lepas harus dicocokkan sebagai kata utuh.

    Pencocokan potongan pernah membuat "sih" cocok di dalam "masih" dan "aja"
    di dalam "saja". Keduanya kata yang muncul di hampir setiap teks formal,
    sehingga esai akademik murni tercatat mengandung ragam informal.
    """

    def test_masih_is_not_counted_as_informal(self):
        features = extract_features(
            "Masih perlu pembanding sebelum kesimpulan ini bisa dipegang. "
            "Analisis tersebut memerlukan data tambahan yang memadai."
        )
        self.assertEqual(features.informal_count, 0)

    def test_saja_is_not_counted_as_informal(self):
        features = extract_features(
            "Pendekatan tersebut saja belum cukup untuk menjelaskan fenomena. "
            "Diperlukan kerangka analitis yang lebih menyeluruh."
        )
        self.assertEqual(features.informal_count, 0)

    def test_real_informal_words_are_still_counted(self):
        features = extract_features(
            "Jujur aja sih aku nggak paham banget bagian ini. "
            "Nanti aku baca lagi deh biar ngerti."
        )
        self.assertGreaterEqual(features.informal_count, 3)

    def test_sayang_is_not_counted_as_first_person(self):
        """"saya" di dalam "sayangnya" bukan sudut pandang orang pertama."""
        features = extract_features(
            "Sayangnya keterbatasan data membuat simpulan tersebut lemah. "
            "Kondisi itu berulang pada beberapa penelitian sebelumnya."
        )
        self.assertEqual(features.personal_count, 0)


class ProcessSignalTest(SimpleTestCase):
    """S4 forensik proses, sinyal yang tidak bisa dihapus dengan parafrase."""

    def test_process_signal_absent_when_no_metadata(self):
        result = score_ai_probability(extract_features(DEEP_HUMAN))
        self.assertNotIn("process_forensics", {s.key for s in result.breakdown})

    def test_process_signal_present_when_metadata_given(self):
        result = score_ai_probability(extract_features(DEEP_HUMAN), RUSHED_PROCESS)
        self.assertIn("process_forensics", {s.key for s in result.breakdown})

    def test_weights_still_sum_to_one_with_process(self):
        """Tanpa penciutan bobot teks, submission yang punya metadata akan
        otomatis berskor lebih tinggi hanya karena sinyalnya lebih banyak."""
        result = score_ai_probability(extract_features(DEEP_HUMAN), RUSHED_PROCESS)
        self.assertAlmostEqual(
            sum(signal.weight for signal in result.breakdown), 1.0, places=3
        )

    def test_process_weight_is_applied(self):
        result = score_ai_probability(extract_features(DEEP_HUMAN), RUSHED_PROCESS)
        process = next(s for s in result.breakdown if s.key == "process_forensics")
        self.assertAlmostEqual(process.weight, PROCESS_WEIGHT, places=6)

    def test_rushed_process_scores_higher_than_patient_process(self):
        """Teks identik, hanya cara pengerjaannya berbeda."""
        features = extract_features(DEEP_HUMAN)
        patient = score_ai_probability(features, PATIENT_PROCESS).score
        rushed = score_ai_probability(features, RUSHED_PROCESS).score
        self.assertLess(patient, rushed)

    def test_process_does_not_touch_bloom_level(self):
        """Kecepatan mengetik tidak mengubah level kognitif sebuah jawaban."""
        patient = analyze_text(DEEP_HUMAN, 4, PATIENT_PROCESS)
        rushed = analyze_text(DEEP_HUMAN, 4, RUSHED_PROCESS)
        self.assertEqual(patient["bloom_level"], rushed["bloom_level"])

    def test_contributions_reconstruct_the_score_with_process(self):
        result = score_ai_probability(extract_features(DEEP_FORMULAIC), RUSHED_PROCESS)
        total = sum(signal.contribution for signal in result.breakdown)
        self.assertAlmostEqual(total, result.score, delta=1.0)

    def test_missing_duration_does_not_crash(self):
        context = ProcessContext(
            duration_seconds=None,
            revision_count=0,
            word_count=120,
            char_count=700,
        )
        result = score_ai_probability(extract_features(DEEP_HUMAN), context)
        self.assertGreaterEqual(result.score, 0)
        self.assertLessEqual(result.score, 100)

    def test_short_answer_is_not_punished_for_zero_revisions(self):
        """Jawaban dua kalimat memang wajar ditulis sekali jadi."""
        short = ProcessContext(
            duration_seconds=6 * 60,
            revision_count=0,
            word_count=40,
            char_count=240,
        )
        process = next(
            s
            for s in score_ai_probability(extract_features(SHALLOW_HUMAN), short).breakdown
            if s.key == "process_forensics"
        )
        self.assertLess(process.value, 0.5)


class ShortTextGuardTest(SimpleTestCase):
    def test_very_short_answer_cannot_reach_high_bloom(self):
        result = analyze_text(
            "Fotosintesis adalah proses. Saya menganalisis dan mengevaluasi.", 5
        )
        self.assertLessEqual(result["bloom_level"], 2)

    def test_very_short_answer_reports_low_confidence(self):
        result = analyze_text(
            "Fotosintesis adalah proses. Saya menganalisis dan mengevaluasi.", 5
        )
        self.assertEqual(result["bloom_confidence"], Confidence.LOW)
