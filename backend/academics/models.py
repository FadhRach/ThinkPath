"""Model akademik: Class, Assignment, Submission, ReasoningEvent, AnalysisResult.

Skema mengikuti docs/DATABASE.md. Catatan F-07 (penting): TIDAK ada field
idle_time/idle_seconds di Submission - sengaja dihilangkan karena ambigu.
"""
from __future__ import annotations

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import EducationLevel, Profile


class AiBand(models.TextChoices):
    LOW = "low", "Low"
    MID = "mid", "Mid"
    HIGH = "high", "High"


class EventType(models.TextChoices):
    STARTED = "started", "Started"
    REVISION = "revision", "Revision"
    PASTE = "paste", "Paste"
    SUBMITTED = "submitted", "Submitted"


class SubmissionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    REVIEWED = "reviewed", "Reviewed"


class Class(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="classes",
    )
    name = models.CharField(max_length=120)
    subject = models.CharField(max_length=80)
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
    )
    join_code = models.CharField(max_length=8, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "classes"
        indexes = [
            models.Index(fields=["owner", "-created_at"], name="classes_owner_recent_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="assignments",
        db_column="class_id",
    )
    title = models.CharField(max_length=160)
    instructions = models.TextField(blank=True, default="")
    deadline = models.DateTimeField(null=True, blank=True)
    expected_bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assignments"
        indexes = [
            models.Index(fields=["class_ref", "-created_at"], name="assign_class_recent_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class Submission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student_profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    text_answer = models.TextField(blank=True, default="")
    started_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    revision_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
    )
    status = models.CharField(
        max_length=16,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.SUBMITTED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "submissions"
        indexes = [
            models.Index(fields=["assignment", "-submitted_at"], name="sub_assign_recent_idx"),
            models.Index(fields=["student_profile", "-submitted_at"], name="sub_student_recent_idx"),
        ]


class ReasoningEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="reasoning_events",
    )
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        db_table = "reasoning_events"
        indexes = [
            models.Index(fields=["submission", "occurred_at"], name="reason_sub_time_idx"),
        ]


class AnalysisResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="analysis",
    )
    ai_score = models.SmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    ai_band = models.CharField(max_length=8, choices=AiBand.choices)
    bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    signals = models.JSONField(default=dict, blank=True)
    recommendation = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "analysis_results"
