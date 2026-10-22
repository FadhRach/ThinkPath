from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import ConsentAction, ConsentRecord, Profile, Role
from apps.accounts.privacy import PRIVACY_POLICY_VERSION, REQUIRED_ITEMS, SOURCE_REGISTER


class RegistrationFlowTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def register(self, role, email="new@campus.test", **overrides):
        return self.client.post("/api/auth/register", {
            "email": email,
            "password": "registration123",
            "display_name": "New Account",
            "role": role,
            "accept_policy": True,
            "policy_version": PRIVACY_POLICY_VERSION,
            **overrides,
        }, format="json")

    def test_registering_records_consent_in_one_step(self):
        for role in (Role.STUDENT, Role.TEACHER):
            with self.subTest(role=role):
                response = self.register(role, email=f"{role}@campus.test")
                self.assertEqual(response.status_code, 201)
                record = ConsentRecord.objects.get(profile_id=response.data["profile"]["id"])
                self.assertEqual(record.action, ConsentAction.GIVEN)
                self.assertEqual(record.policy_version, PRIVACY_POLICY_VERSION)
                self.assertEqual(record.items, sorted(REQUIRED_ITEMS[role]))
                self.assertEqual(record.source, SOURCE_REGISTER)
                self.assertIsNotNone(record.created_at)

    def test_registration_without_the_checkbox_creates_nothing(self):
        for overrides in ({"accept_policy": False}, {"accept_policy": None}, {"policy_version": "2020-01-01"}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.register(Role.STUDENT, **overrides).status_code, 400)
        missing = self.client.post("/api/auth/register", {
            "email": "x@campus.test", "password": "registration123",
            "display_name": "X", "role": Role.STUDENT,
        }, format="json")
        self.assertEqual(missing.status_code, 400)
        self.assertFalse(Profile.objects.exists())
        self.assertFalse(ConsentRecord.objects.exists())

    def test_new_accounts_load_empty_dashboards_straight_after_registering(self):
        for role in (Role.STUDENT, Role.TEACHER):
            with self.subTest(role=role):
                self.client.credentials()
                response = self.register(role, email=f"{role}@campus.test")
                self.assertEqual(response.status_code, 201)
                profile = Profile.objects.get(id=response.data["profile"]["id"])
                self.assertTrue(profile.check_password("registration123"))
                self.assertNotIn("password", response.data["profile"])
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['token']}")
                self.assertEqual(self.client.get("/api/me").status_code, 200)
                paths = ("/api/student/classes", "/api/student/progress", "/api/student/materials", "/api/student/schedule") if role == Role.STUDENT else (
                    "/api/classes", "/api/assignments", "/api/submissions", "/api/overview", "/api/reports/overview", "/api/cekpaham",
                )
                for path in (*paths, "/api/notifications"):
                    with self.subTest(path=path):
                        self.assertEqual(self.client.get(path).status_code, 200)

    def test_duplicate_email_is_a_validation_error_even_with_different_case(self):
        self.assertEqual(self.register(Role.STUDENT).status_code, 201)
        response = self.register(Role.TEACHER, email="NEW@campus.test")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data["email"][0]), "Email sudah terdaftar.")
        self.assertEqual(Profile.objects.count(), 1)

    def test_registered_account_can_log_in_again(self):
        self.assertEqual(self.register(Role.STUDENT).status_code, 201)
        response = self.client.post("/api/auth/login", {
            "email": "NEW@campus.test", "password": "registration123", "role": Role.STUDENT,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["token"])

    def test_invalid_registration_does_not_create_an_account(self):
        response = self.client.post("/api/auth/register", {
            "email": "bad-email", "password": "short", "display_name": "", "role": Role.STUDENT,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Profile.objects.exists())

    def test_email_is_stored_lowercase_and_login_ignores_case(self):
        self.assertEqual(self.register(Role.STUDENT, email="  Mixed@Campus.Test ").status_code, 201)
        self.assertTrue(Profile.objects.filter(email="mixed@campus.test").exists())
        response = self.client.post("/api/auth/login", {
            "email": "MIXED@campus.test",
            "password": "registration123",
        }, format="json")
        self.assertEqual(response.status_code, 200)

    def test_database_rejects_case_duplicate_even_without_serializer(self):
        """Pendaftaran serentak lolos pemeriksaan serializer; constraint DB menolaknya."""
        from django.db import IntegrityError, transaction

        Profile.objects.create(email="dup@campus.test", role=Role.STUDENT)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Profile.objects.create(email="DUP@campus.test", role=Role.TEACHER)
