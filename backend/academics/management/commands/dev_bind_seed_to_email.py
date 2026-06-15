"""Dev helper: ikat data seed ke user Supabase Auth yang sudah ada.

Cara pakai:
    python manage.py dev_bind_seed_to_email kamu@example.com

Command ini:
1. Cari user Supabase di tabel `auth.users` (database yang sama dengan Django) berdasarkan email.
2. Ambil id-nya (UUID).
3. Pindahkan semua kepemilikan dari `Profile` teacher seed ke id user tersebut:
   - Update FK di `classes.owner_id`
   - Hapus baris `profiles` teacher seed yang lama
   - Buat/update `profiles` untuk user baru (role=teacher, display_name dari seed)

Setelah ini, login dengan email yang sama → dashboard akan menampilkan data seed.

Catatan: command ini HANYA untuk development. Tidak aman untuk production.
"""
from __future__ import annotations

import uuid

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from academics.models import Class
from core.models import Profile, Role


SEED_TEACHER_ID = uuid.UUID("e8665366-3ce8-59ed-8aaa-cd1ae51b0a7d")


def _lookup_supabase_user(email: str) -> tuple[uuid.UUID, str] | None:
    with connection.cursor() as cur:
        cur.execute(
            "SELECT id, email FROM auth.users WHERE lower(email) = lower(%s) LIMIT 1",
            [email],
        )
        row = cur.fetchone()
    if row is None:
        return None
    return uuid.UUID(str(row[0])), str(row[1])


class Command(BaseCommand):
    help = "Bind data seed teacher ke user Supabase Auth yang sudah register dengan email tertentu."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="Email user Supabase yang sudah register.")

    def handle(self, *args, **options):
        email: str = options["email"]

        user = _lookup_supabase_user(email)
        if user is None:
            raise CommandError(
                f"Tidak menemukan user Supabase Auth dengan email '{email}'. "
                "Pastikan kamu sudah register dulu di /register, lalu jalankan command ini."
            )
        new_user_id, real_email = user

        seed_profile = Profile.objects.filter(pk=SEED_TEACHER_ID).first()
        if seed_profile is None:
            raise CommandError(
                "Profil seed teacher tidak ditemukan. Jalankan `seed_demo_data` dulu."
            )

        if new_user_id == SEED_TEACHER_ID:
            self.stdout.write("User Supabase ini sudah punya id sama dengan seed teacher. Tidak ada yang perlu diubah.")
            return

        with transaction.atomic():
            display_name = seed_profile.display_name or "Bu Ningsih"

            target, _ = Profile.objects.update_or_create(
                pk=new_user_id,
                defaults={
                    "email": real_email,
                    "display_name": display_name,
                    "role": Role.TEACHER,
                    "education_level": seed_profile.education_level,
                },
            )

            Class.objects.filter(owner_id=SEED_TEACHER_ID).update(owner_id=target.pk)

            seed_profile.delete()

        self.stdout.write(
            f"Bound seed teacher data to user {real_email} (id={new_user_id}). "
            "Login dengan email itu lalu buka /dashboard."
        )
