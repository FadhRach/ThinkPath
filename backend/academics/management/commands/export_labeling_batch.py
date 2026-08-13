"""Ekspor jawaban mahasiswa menjadi batch pelabelan Bloom yang tersamar.

Perintah ini menjembatani produksi dan ai_experiment. Keluarannya langsung bisa
dibuka di ai_experiment/tools/label.html, dan berkas yang sama dipakai sebagai
--answers pada src.evaluate_bloom, sehingga id pada label dan id pada teks
dijamin cocok tanpa penjodohan manual.

**Penyamaran bukan hiasan, melainkan syarat sahnya angka.** Berkas batch hanya
memuat id dan teks. Nama mahasiswa, soal tugasnya, target Bloom yang ditetapkan
dosen, dan seluruh keluaran analisis sengaja ditahan di berkas kunci terpisah.
Alasannya sama dengan alasan E2 tidak boleh membaca ai_score: penilai yang tahu
tugasnya menargetkan C4 akan condong menuliskan C4, dan kesepakatan yang
terbentuk dari anchor bersama itu hanya mengukur anchor-nya, bukan jawabannya.

Contoh:

    python manage.py export_labeling_batch --out ../ai_experiment/data/labels
    python manage.py export_labeling_batch --limit 60 --class-name "Metodologi"
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

from django.core.management.base import BaseCommand

from academics.models import Submission

# Jawaban yang terlalu pendek tidak memuat cukup penalaran untuk dinilai, dan
# hanya menambah item "X / tidak bisa dinilai" yang membuang waktu penilai.
MIN_WORDS = 40


class Command(BaseCommand):
    help = "Ekspor jawaban mahasiswa sebagai batch pelabelan Bloom yang tersamar."

    def add_arguments(self, parser):
        parser.add_argument(
            "--out",
            default="../ai_experiment/data/labels",
            help="folder tujuan (relatif terhadap manage.py)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="banyaknya item; 0 berarti semua yang memenuhi syarat",
        )
        parser.add_argument(
            "--class-name",
            default="",
            help="saring berdasarkan potongan nama kelas",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="benih pengacakan urutan, supaya batch bisa direproduksi",
        )

    def handle(self, *args, **options):
        out_dir = Path(options["out"])
        out_dir.mkdir(parents=True, exist_ok=True)

        queryset = Submission.objects.exclude(text_answer="").select_related(
            "assignment", "assignment__class_ref", "student_profile"
        )
        if options["class_name"]:
            queryset = queryset.filter(
                assignment__class_ref__name__icontains=options["class_name"]
            )

        rows = [
            submission
            for submission in queryset
            if len(submission.text_answer.split()) >= MIN_WORDS
        ]

        # Urutan diacak supaya penilai tidak menghadapi seluruh jawaban satu
        # tugas berturut turut. Membaca sepuluh jawaban dari soal yang sama
        # membuat penilai membandingkan antar mahasiswa, padahal yang diminta
        # rubrik adalah menilai tiap jawaban terhadap rubrik itu sendiri.
        random.Random(options["seed"]).shuffle(rows)
        if options["limit"] > 0:
            rows = rows[: options["limit"]]

        if not rows:
            self.stdout.write(
                "Tidak ada jawaban yang memenuhi syarat. "
                f"Batas minimum {MIN_WORDS} kata."
            )
            return

        batch_path = out_dir / "jawaban.csv"
        key_path = out_dir / "kunci_batch.csv"

        with batch_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["id", "text"])
            for index, submission in enumerate(rows, start=1):
                writer.writerow([f"J{index:03d}", submission.text_answer])

        # Kunci tetap terpisah dan tidak pernah dibuka penilai. Berkas ini yang
        # nanti dipakai menautkan hasil pelabelan kembali ke submission aslinya.
        with key_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                ["id", "submission_id", "kelas", "tugas", "target_bloom"]
            )
            for index, submission in enumerate(rows, start=1):
                assignment = submission.assignment
                writer.writerow(
                    [
                        f"J{index:03d}",
                        str(submission.id),
                        assignment.class_ref.name,
                        assignment.title,
                        assignment.expected_bloom_level,
                    ]
                )

        self.stdout.write(f"{len(rows)} item ditulis.")
        self.stdout.write(f"  batch penilai : {batch_path}")
        self.stdout.write(f"  kunci (jangan dibuka penilai): {key_path}")
        self.stdout.write("")
        self.stdout.write(
            "Buka ai_experiment/tools/label.html di dua peramban berbeda, muat "
            "jawaban.csv, dan labeli terpisah tanpa berdiskusi. Setelah keduanya "
            "selesai:"
        )
        self.stdout.write(
            "  python -m src.evaluate_bloom --raters "
            "data/labels/penilai1.csv data/labels/penilai2.csv"
        )
