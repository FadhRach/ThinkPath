"""Enum hasil analisis.

Dipisah dari models.py supaya mesin skor (engines/, providers/) bisa diimpor
tanpa memuat model Django. ai_experiment memakai mesin yang sama persis.
"""
from __future__ import annotations

from django.db import models


class AiBand(models.TextChoices):
    LOW = "low", "Low"
    MID = "mid", "Mid"
    HIGH = "high", "High"


class Confidence(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class AnalysisSource(models.TextChoices):
    """Mesin yang menghasilkan SKOR AI pada satu baris AnalysisResult.

    Cakupannya asal skor AI saja, bukan seluruh baris: skor AI bisa datang dari
    detektor sementara level Bloom tetap dari LLM atau heuristik. Keyakinan
    Bloom punya kolomnya sendiri (bloom_confidence).

    DETECTOR sengaja tidak menyebut nama penyedia. Penyedia sudah pernah gugur
    (Sapling, English-only), dan nama penyedia + versi model sudah tercatat per
    baris di signal_breakdown, jadi pergantian penyedia tidak menuntut migrasi.
    """

    LLM = "llm", "LLM"
    HEURISTIC = "heuristic", "Heuristic"
    SEED = "seed", "Seed demo"
    DETECTOR = "detector", "External detector"
