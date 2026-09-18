"""Tes peran yang dipilih di layar login.

Keputusan produk yang dijaga: memilih peran Mahasiswa dengan akun dosen, atau
sebaliknya, harus ditolak. Sebelumnya login mengabaikan pilihan itu dan langsung
mengarahkan ke dashboard sesuai peran akun, sehingga pilihan di layar tidak
berarti apa pun.

Dua hal lain yang juga dijaga:

1. **Penolakan peran hanya terjadi setelah kata sandi benar.** Kata sandi salah
   tetap dijawab 401 dengan pesan umum, supaya peran sebuah email tidak bisa
   ditebak tanpa kata sandinya.
2. **Permintaan tanpa peran tetap diterima.** Frontend dan backend di-deploy
   terpisah, jadi frontend lama yang belum mengirim peran tidak boleh ikut
   gagal login.
"""
from __future__ import annotations

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Profile, Role
from core.services import register_profile

PASSWORD = "rahasia123"


class LoginRoleTest(TestCase):
    def setUp(self):
        # Batas laju login disimpan di cache; bersihkan supaya tes tidak saling
        # memengaruhi.
        cache.clear()
        self.client = APIClient()
        self.dosen = register_profile(
            email="dosen@kampus.test",
            password=PASSWORD,
            display_name="Dosen Uji",
            role=Role.TEACHER,
        )
        self.mahasiswa = register_profile(
            email="mhs@kampus.test",
            password=PASSWORD,
            display_name="Mahasiswa Uji",
            role=Role.STUDENT,
        )

    def login(self, email: str, password: str = PASSWORD, role: str | None = None):
        payload = {"email": email, "password": password}
        if role is not None:
            payload["role"] = role
        return self.client.post("/api/auth/login", payload, format="json")

    def test_matching_role_logs_in(self):
        for profile in (self.dosen, self.mahasiswa):
            response = self.login(profile.email, role=profile.role)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["profile"]["role"], profile.role)
            self.assertTrue(response.data["token"])

    def test_teacher_account_rejected_as_student(self):
        response = self.login(self.dosen.email, role=Role.STUDENT)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("token", response.data)
        self.assertEqual(
            response.data["detail"],
            "Akun ini terdaftar sebagai dosen. Pilih peran Dosen untuk masuk.",
        )

    def test_student_account_rejected_as_teacher(self):
        response = self.login(self.mahasiswa.email, role=Role.TEACHER)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("token", response.data)
        self.assertEqual(
            response.data["detail"],
            "Akun ini terdaftar sebagai mahasiswa. Pilih peran Mahasiswa untuk masuk.",
        )

    def test_wrong_password_does_not_reveal_role(self):
        response = self.login(self.dosen.email, password="salah-total", role=Role.STUDENT)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["detail"], "Email atau kata sandi salah.")

    def test_request_without_role_still_logs_in(self):
        response = self.login(self.dosen.email)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["profile"]["role"], Role.TEACHER)

    def test_unknown_role_is_a_validation_error(self):
        response = self.login(self.dosen.email, role="admin")
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)
