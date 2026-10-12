from unittest.mock import patch

from django.conf import settings
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient


class TestSettingsTest(SimpleTestCase):
    def test_tests_never_use_external_database(self):
        """DATABASE_URL di .env (mis. server produksi) tidak boleh dipakai tes."""
        database = settings.DATABASES["default"]
        self.assertEqual(database["ENGINE"], "django.db.backends.sqlite3")


class HealthViewTest(TestCase):
    def test_ok_when_database_reachable(self):
        response = APIClient().get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_503_when_database_down(self):
        with patch("common.views.connection.cursor", side_effect=DatabaseError("down")):
            response = APIClient().get("/health")
        self.assertEqual(response.status_code, 503)
