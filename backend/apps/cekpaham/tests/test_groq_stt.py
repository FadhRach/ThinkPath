from unittest.mock import MagicMock, patch

import requests
from django.test import SimpleTestCase

from apps.cekpaham.providers import groq_stt


def seg(text, start=0.0, end=5.0, logprob=-0.1, no_speech=0.0, ratio=1.2):
    return {
        "start": start, "end": end, "text": text,
        "avg_logprob": logprob, "no_speech_prob": no_speech, "compression_ratio": ratio,
    }


def reply(status=200, body=None, text=""):
    response = MagicMock()
    response.status_code = status
    response.json.return_value = body
    response.text = text or str(body)
    return response


def body(segments, duration=5.0):
    return {"duration": duration, "segments": segments, "text": " ".join(s["text"] for s in segments)}


class FilterSegmentsTest(SimpleTestCase):
    def reasons(self, segments, duration):
        return [d["reason"] for d in groq_stt.filter_segments(segments, duration)[1]]

    def test_real_speech_is_kept(self):
        kept, dropped = groq_stt.filter_segments([seg("Saya memilih rekursif.", end=9.16)], 9.18)
        self.assertEqual(len(kept), 1)
        self.assertEqual(dropped, [])

    def test_silence_hallucination_seen_in_production_is_dropped(self):
        # Klip hening 6 dtk -> "Terima kasih." dengan no_speech_prob 0 dan segmen
        # berakhir di detik 29,98. Angka kepercayaan saja tidak menangkapnya.
        silence = seg("Terima kasih.", end=29.98, logprob=-0.12, no_speech=0, ratio=0.64)
        self.assertEqual(self.reasons([silence], 6.0), ["beyond_audio"])

    def test_known_closing_phrase_is_dropped_even_within_time(self):
        self.assertEqual(self.reasons([seg("Terima kasih.", end=2.0)], 2.0), ["known_phrase"])
        self.assertEqual(self.reasons([seg("Thanks for watching!", end=2.0)], 2.0), ["known_phrase"])
        self.assertEqual(self.reasons([seg("Subtitles by the Amara.org community", end=2.0)], 2.0), ["known_phrase"])

    def test_phrase_inside_a_longer_sentence_is_kept(self):
        kept, _ = groq_stt.filter_segments([seg("Terima kasih karena sudah bertanya soal itu.", end=3.0)], 3.0)
        self.assertEqual(len(kept), 1)

    def test_no_speech_needs_both_signals(self):
        self.assertEqual(self.reasons([seg("blah", no_speech=0.9, logprob=-1.5)], 5.0), ["no_speech"])
        self.assertEqual(self.reasons([seg("blah", no_speech=0.9, logprob=-0.3)], 5.0), [])

    def test_repetitive_segment_is_dropped(self):
        self.assertEqual(self.reasons([seg("ya ya ya ya", ratio=3.1)], 5.0), ["repetitive"])

    def test_missing_scores_do_not_crash_or_drop(self):
        kept, _ = groq_stt.filter_segments([seg("Isi jawaban", logprob=None, no_speech=None, ratio=None)], None)
        self.assertEqual(len(kept), 1)


@patch.dict("os.environ", {"GROQ_API_KEY": "kunci-uji"})
class TranscribeTest(SimpleTestCase):
    def call(self, **kwargs):
        return groq_stt.transcribe(b"audio", "audio/webm", "id", **kwargs)

    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_success_returns_text_offset_and_quality(self, post):
        post.return_value = reply(body=body([seg("Halo dunia.", start=1.4, end=3.0)], duration=3.1))
        result = self.call(keyterms=["rekursif", "pohon"])
        self.assertTrue(result.ok)
        self.assertEqual(result.text, "Halo dunia.")
        self.assertEqual(result.first_speech_offset_s, 1.4)
        self.assertEqual(result.duration_s, 3.1)
        sent = post.call_args.kwargs
        self.assertEqual(sent["data"]["language"], "id")
        self.assertEqual(sent["data"]["temperature"], "0")
        self.assertEqual(sent["data"]["prompt"], "rekursif, pohon")
        self.assertEqual(sent["files"]["file"][0], "audio.webm")

    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_silence_becomes_no_speech_not_an_answer(self, post):
        post.return_value = reply(body=body([seg("Terima kasih.", end=29.98)], duration=6.0))
        result = self.call()
        self.assertTrue(result.no_speech)
        self.assertEqual(result.dropped[0]["reason"], "beyond_audio")

    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_text_without_segments_is_still_used(self, post):
        post.return_value = reply(body={"text": "Jawaban saya begini", "duration": 4.0})
        self.assertEqual(self.call().text, "Jawaban saya begini")

    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_unsure_segments_are_exposed(self, post):
        post.return_value = reply(body=body([seg("jelas", logprob=-0.1), seg("sam bar", start=2, end=4, logprob=-1.2)]))
        self.assertEqual(self.call().quality()["unsure"], ["sam bar"])

    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_prompt_is_capped(self, post):
        post.return_value = reply(body=body([seg("ok")]))
        self.call(keyterms=["kata" * 50] * 20)
        self.assertLessEqual(len(post.call_args.kwargs["data"]["prompt"]), groq_stt.PROMPT_MAX_CHARS)

    @patch("apps.cekpaham.providers.groq_stt.time.sleep")
    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_per_minute_limit_is_retried(self, post, sleep):
        post.side_effect = [
            reply(429, text="Rate limit reached for requests per minute (RPM)"),
            reply(body=body([seg("Berhasil.")])),
        ]
        self.assertEqual(self.call().text, "Berhasil.")
        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once()

    @patch("apps.cekpaham.providers.groq_stt.time.sleep")
    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_daily_quota_is_not_retried(self, post, sleep):
        post.return_value = reply(429, text="Rate limit reached ... requests per day (RPD)")
        self.assertEqual(self.call().error_code, "stt_quota")
        self.assertEqual(post.call_count, 1)

    @patch("apps.cekpaham.providers.groq_stt.time.sleep")
    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_errors_map_to_codes(self, post, sleep):
        cases = [
            (reply(401, text="invalid key"), "stt_auth"),
            (reply(400, text="bad file"), "stt_bad_audio"),
            (reply(413, text="too large"), "stt_bad_audio"),
            (reply(500, text="boom"), "stt_unavailable"),
            (reply(429, text="slow down"), "stt_rate_limited"),
            (reply(200, body=None), "stt_bad_response"),
        ]
        for response, code in cases:
            post.reset_mock()
            post.return_value = response
            self.assertEqual(self.call().error_code, code, code)

    @patch("apps.cekpaham.providers.groq_stt.requests.post", side_effect=requests.Timeout)
    def test_timeout_is_a_code_not_an_exception(self, post):
        self.assertEqual(self.call().error_code, "stt_timeout")

    @patch("apps.cekpaham.providers.groq_stt.time.sleep")
    @patch("apps.cekpaham.providers.groq_stt.requests.post", side_effect=requests.ConnectionError)
    def test_network_failure_is_a_code(self, post, sleep):
        self.assertEqual(self.call().error_code, "stt_unavailable")

    @patch("apps.cekpaham.providers.groq_stt.requests.post")
    def test_live_mode_does_not_retry(self, post):
        post.return_value = reply(500, text="boom")
        self.call(budget_s=groq_stt.LIVE_BUDGET_SECONDS, retries=0)
        self.assertEqual(post.call_count, 1)

    @patch.dict("os.environ", {"GROQ_API_KEY": ""})
    def test_not_configured(self):
        self.assertEqual(self.call().error_code, "stt_not_configured")
