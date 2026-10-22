from django.test import SimpleTestCase

from apps.cekpaham import rubric
from apps.cekpaham.keyterms import extract_keyterms


class RubricTest(SimpleTestCase):
    def levels(self, value, **override):
        return {**{d: value for d in rubric.DIMENSIONS}, **override}

    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(rubric.WEIGHTS.values()), 1.0)

    def test_score_is_computed_from_levels(self):
        self.assertEqual(rubric.score_from_levels(self.levels(3)), 100)
        self.assertEqual(rubric.score_from_levels(self.levels(0)), 0)
        self.assertEqual(rubric.score_from_levels(self.levels(2)), 67)

    def test_weights_matter(self):
        accuracy_only = rubric.score_from_levels(self.levels(0, accuracy=3))
        ownership_only = rubric.score_from_levels(self.levels(0, ownership=3))
        self.assertEqual((accuracy_only, ownership_only), (35, 15))

    def test_every_dimension_has_four_anchors(self):
        for name in rubric.DIMENSIONS:
            self.assertEqual(len(rubric.ANCHORS[name]), rubric.MAX_LEVEL + 1)

    def test_band_boundaries(self):
        self.assertEqual(rubric.band_from_score(70), "kuat")
        self.assertEqual(rubric.band_from_score(69), "sebagian")
        self.assertEqual(rubric.band_from_score(40), "sebagian")
        self.assertEqual(rubric.band_from_score(39), "lemah")


class KeytermsTest(SimpleTestCase):
    def test_technical_terms_come_first(self):
        terms = extract_keyterms("Jelaskan pendekatan rekursif pada HashMap", "rekursif cocok untuk pohon, DFS")
        self.assertEqual(terms[:2], ["HashMap", "DFS"])
        self.assertIn("rekursif", terms)
        self.assertNotIn("Jelaskan", terms)

    def test_limit_and_empty(self):
        self.assertEqual(extract_keyterms(""), [])
        many = " ".join(f"istilah{i}abc" for i in range(60))
        self.assertEqual(len(extract_keyterms(many)), 30)
