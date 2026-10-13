#!/usr/bin/env python
import os
import sys


def main() -> None:
    # Tes SELALU memakai settings test (SQLite in-memory), apa pun isi env,
    # supaya `manage.py test` tidak pernah menyentuh basis data sungguhan.
    if sys.argv[1:2] == ["test"]:
        os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.test"
    else:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django belum terpasang. Jalankan `pip install -r requirements.txt` "
            "di virtualenv yang aktif."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
