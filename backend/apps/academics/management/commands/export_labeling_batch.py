"""Ekspor jawaban jadi batch pelabelan Bloom tersamar (untuk ai_experiment/tools/label.html dan evaluate_bloom).

Batch hanya berisi id + teks; nama, soal, target Bloom, dan hasil analisis di berkas kunci terpisah
agar penilai tidak ter-anchor. Contoh: python manage.py export_labeling_batch --out ../ai_experiment/data/labels
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.academics.models import Submission

# Jawaban terlalu pendek hanya menambah item "tidak bisa dinilai".
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

        # Diacak agar penilai tidak membandingkan jawaban satu tugas berturut-turut.
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

        # Kunci terpisah, tidak dibuka penilai; dipakai menautkan label ke submission asli.
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
            "  salin ke ai_experiment/data/labels/ sebagai penilai1.csv dan penilai2.csv, "
            "lalu jalankan ai_experiment/notebooks/05_validasi_bloom.ipynb"
        )
