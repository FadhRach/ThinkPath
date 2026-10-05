from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Profile, Role
from core.privacy import PRIVACY_POLICY_VERSION, REQUIRED_ITEMS


class RegistrationFlowTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def register(self, role, email="new@campus.test"):
        return self.client.post("/api/auth/register", {
            "email": email,
            "password": "registration123",
            "display_name": "New Account",
            "role": role,
        }, format="json")

    def test_new_accounts_can_consent_and_load_empty_dashboards(self):
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
                consent = self.client.post("/api/me/consent", {
                    "policy_version": PRIVACY_POLICY_VERSION,
                    "items": list(REQUIRED_ITEMS[role]),
                }, format="json")
                self.assertEqual(consent.status_code, 201)
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {consent.data['token']}")
                paths = ("/api/student/classes", "/api/student/progress", "/api/student/materials", "/api/student/schedule") if role == Role.STUDENT else (
                    "/api/classes", "/api/assignments", "/api/submissions", "/api/overview", "/api/reports/overview", "/api/verifications",
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
