"""Jenjang, prodi, dan semester adalah milik kelas, bukan milik tugas.

Sebelumnya Assignment menyimpan education_level sendiri, menduplikasi kolom yang
sama di Class. Duplikasi itu memungkinkan sebuah tugas tersimpan dengan jenjang
berbeda dari kelas tempatnya berada, keadaan yang tidak punya arti apa pun dan
membuat dua sumber kebenaran untuk satu fakta.

Kolom itu sudah dihapus. Serializer tetap memaparkannya, tetapi bersumber dari
kelas, sehingga kontrak API tidak berubah bagi frontend.

Tes di sini sengaja tidak menyentuh basis data: keduanya memeriksa deklarasi,
bukan perilaku runtime, sehingga tetap cepat dan tidak butuh migrasi.
"""
from __future__ import annotations

from django.test import SimpleTestCase

from academics.models import Assignment, Class
from academics.serializers import (
    AssignmentCreateSerializer,
    AssignmentListSerializer,
    AssignmentMiniSerializer,
    ClassCreateSerializer,
    StudentAssignmentSerializer,
)


def _field_names(model) -> set[str]:
    return {field.name for field in model._meta.get_fields()}


class AssignmentHasNoOwnLevelTest(SimpleTestCase):
    def test_education_level_column_is_gone(self):
        self.assertNotIn("education_level", _field_names(Assignment))

    def test_class_still_owns_the_level(self):
        self.assertIn("education_level", _field_names(Class))

    def test_create_serializer_refuses_to_accept_a_level(self):
        """Menerimanya sebagai masukan akan menghidupkan lagi dua sumber kebenaran."""
        self.assertNotIn("education_level", AssignmentCreateSerializer().fields)


class LevelIsSourcedFromClassTest(SimpleTestCase):
    """Semua serializer tugas harus membaca jenjang dari class_ref."""

    def test_mini_serializer_sources_from_class(self):
        fields = AssignmentMiniSerializer().fields
        self.assertEqual(fields["education_level"].source, "class_ref.education_level")
        self.assertEqual(fields["program_studi"].source, "class_ref.program_studi")
        self.assertEqual(fields["semester"].source, "class_ref.semester")

    def test_list_serializer_sources_from_class(self):
        fields = AssignmentListSerializer().fields
        self.assertEqual(fields["education_level"].source, "class_ref.education_level")

    def test_student_serializer_sources_from_class(self):
        fields = StudentAssignmentSerializer().fields
        self.assertEqual(fields["education_level"].source, "class_ref.education_level")


class ClassCarriesProgramMetadataTest(SimpleTestCase):
    def test_class_has_program_studi_and_semester(self):
        names = _field_names(Class)
        self.assertIn("program_studi", names)
        self.assertIn("semester", names)

    def test_both_are_optional(self):
        """Prodi kosong untuk mata kuliah umum, semester kosong untuk kelas
        yang ditawarkan lintas semester. Memaksakannya wajib akan membuat dosen
        mengisi data karangan."""
        program_studi = Class._meta.get_field("program_studi")
        semester = Class._meta.get_field("semester")
        self.assertTrue(program_studi.blank)
        self.assertTrue(semester.null)

    def test_create_serializer_accepts_them(self):
        fields = ClassCreateSerializer().fields
        self.assertIn("program_studi", fields)
        self.assertIn("semester", fields)

    def test_semester_is_not_stored_on_the_student_profile(self):
        """Semester mahasiswa berubah tiap enam bulan.

        Menyimpannya di Profile berarti datanya basi terus dan harus diperbarui
        manual. Sebuah kelas sebaliknya permanen berstatus "semester 3".
        """
        from core.models import Profile

        self.assertNotIn("semester", _field_names(Profile))
