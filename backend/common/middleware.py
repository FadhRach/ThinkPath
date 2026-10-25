"""Middleware kecil untuk seluruh API."""
from __future__ import annotations


class NoStoreMiddleware:
    """Jawaban API berisi data pribadi dan penilaian; jangan disimpan cache perantara/peramban.

    Sebelumnya tidak ada Cache-Control sama sekali, jadi proxy bersama (mis. jaringan
    kampus) boleh menyimpan balasan ber-token secara heuristik.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/") and "Cache-Control" not in response:
            response["Cache-Control"] = "no-store"
        return response
