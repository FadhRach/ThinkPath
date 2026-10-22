"""CekPaham tidak boleh bergantung pada mesin E1/E2, dan sebaliknya."""
import ast
from pathlib import Path

from django.test import SimpleTestCase

import apps.analysis
import apps.cekpaham

ALLOWED = ("apps.analysis.providers",)  # hanya klien Groq yang dipakai bersama


def imported_modules(path: Path) -> set[str]:
    found = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
            found.update(f"{node.module}.{alias.name}" for alias in node.names)
    return found


class DecouplingTest(SimpleTestCase):
    def sources(self, package, skip=()):
        root = Path(package.__file__).parent
        return [p for p in root.rglob("*.py") if not any(part in skip for part in p.parts)]

    def test_cekpaham_does_not_import_the_analysis_engines(self):
        offenders = {
            f"{path.name}: {module}"
            for path in self.sources(apps.cekpaham, skip=("tests", "migrations"))
            for module in imported_modules(path)
            if module.startswith("apps.analysis") and not module.startswith(ALLOWED)
        }
        self.assertEqual(offenders, set())

    def test_analysis_does_not_know_about_cekpaham(self):
        offenders = {
            f"{path.name}: {module}"
            for path in self.sources(apps.analysis, skip=("tests", "migrations"))
            for module in imported_modules(path)
            if "cekpaham" in module
        }
        self.assertEqual(offenders, set())
