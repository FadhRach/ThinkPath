"""Enum hasil analisis; terpisah dari models.py agar engines/ bisa diimpor tanpa model Django."""
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
    """Asal SKOR AI saja (Bloom bisa dari sumber lain). "llm" hanya ada di baris lama."""

    LLM = "llm", "LLM"
    HEURISTIC = "heuristic", "Heuristic"
    SEED = "seed", "Seed demo"
    DETECTOR = "detector", "External detector"
