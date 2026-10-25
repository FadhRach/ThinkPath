"""Tes to-do pribadi mahasiswa: CRUD, isolasi antar pemilik, dan batas."""
from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.authentication import create_access_token
from apps.accounts.models import Profile, Role
from apps.todos.models import StudentTodo
from apps.todos.views import MAX_OPEN_TODOS


def _client(profile: Profile) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class TodoTest(TestCase):
    def setUp(self):
        self.mhs = Profile.objects.create(email="m@t.local", display_name="M", role=Role.STUDENT)
        self.lain = Profile.objects.create(email="l@t.local", display_name="L", role=Role.STUDENT)
        self.dosen = Profile.objects.create(email="d@t.local", display_name="D", role=Role.TEACHER)
        self.client = _client(self.mhs)

    def test_create_list_toggle_and_delete(self):
        created = self.client.post(
            "/api/student/todos", {"title": "  Baca bab 3  ", "due_on": "2026-11-02"}, format="json"
        )
        self.assertEqual(created.status_code, 201)
        body = created.json()
        self.assertEqual(body["title"], "Baca bab 3")
        self.assertFalse(body["done"])

        done = self.client.patch(f"/api/student/todos/{body['id']}", {"done": True}, format="json")
        self.assertEqual(done.status_code, 200)
        self.assertTrue(done.json()["done"])
        self.assertIsNotNone(done.json()["done_at"])
        undone = self.client.patch(f"/api/student/todos/{body['id']}", {"done": False}, format="json")
        self.assertIsNone(undone.json()["done_at"])

        self.assertEqual(len(self.client.get("/api/student/todos").json()), 1)
        self.assertEqual(self.client.delete(f"/api/student/todos/{body['id']}").status_code, 204)
        self.assertEqual(self.client.get("/api/student/todos").json(), [])

    def test_list_puts_open_items_first_ordered_by_due_date(self):
        StudentTodo.objects.create(owner=self.mhs, title="Selesai", done=True)
        StudentTodo.objects.create(owner=self.mhs, title="Nanti", due_on="2026-12-01")
        StudentTodo.objects.create(owner=self.mhs, title="Segera", due_on="2026-11-01")
        titles = [item["title"] for item in self.client.get("/api/student/todos").json()]
        self.assertEqual(titles, ["Segera", "Nanti", "Selesai"])

    def test_items_are_private_to_their_owner(self):
        item = StudentTodo.objects.create(owner=self.mhs, title="Rahasia")
        other = _client(self.lain)
        self.assertEqual(other.get("/api/student/todos").json(), [])
        self.assertEqual(other.patch(f"/api/student/todos/{item.id}", {"done": True}, format="json").status_code, 404)
        self.assertEqual(other.delete(f"/api/student/todos/{item.id}").status_code, 404)
        item.refresh_from_db()
        self.assertFalse(item.done)

    def test_teachers_are_rejected(self):
        client = _client(self.dosen)
        self.assertEqual(client.get("/api/student/todos").status_code, 403)
        self.assertEqual(client.post("/api/student/todos", {"title": "x"}, format="json").status_code, 403)

    def test_validation_and_open_item_limit(self):
        self.assertEqual(self.client.post("/api/student/todos", {"title": "  "}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/student/todos", {"title": "x" * 201}, format="json").status_code, 400)
        StudentTodo.objects.bulk_create(
            [StudentTodo(owner=self.mhs, title=f"Butir {i}") for i in range(MAX_OPEN_TODOS)]
        )
        full = self.client.post("/api/student/todos", {"title": "Satu lagi"}, format="json")
        self.assertEqual(full.status_code, 400)
        # Butir yang sudah selesai tidak dihitung sebagai beban.
        first = StudentTodo.objects.filter(owner=self.mhs).first()
        first.done = True
        first.save()
        self.assertEqual(self.client.post("/api/student/todos", {"title": "Muat"}, format="json").status_code, 201)

    def test_account_deletion_removes_todos(self):
        from apps.accounts.deletion import delete_account

        StudentTodo.objects.create(owner=self.mhs, title="Hilang")
        delete_account(self.mhs)
        self.assertFalse(StudentTodo.objects.filter(title="Hilang").exists())
