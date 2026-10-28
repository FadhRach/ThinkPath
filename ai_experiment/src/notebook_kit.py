"""Utilitas bersama notebook 07 (E1), 08 (ASR Cek Paham), dan 09 (E2 Bloom).

Isinya hanya hal yang dipakai lebih dari satu notebook: kunci API, panggilan Groq
dengan percobaan ulang, pengukur waktu, interval kepercayaan, dan penyimpan hasil.
Logika penilaian tetap milik backend; modul ini tidak menyalinnya.
"""
from __future__ import annotations

import json
import math
import os
import random
import re
import time
from pathlib import Path

import requests

from .config import BASE_DIR, RESULTS_DIR

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
FIGURES_DIR = RESULTS_DIR / "figures"

# gpt-oss-120b paket gratis: 8K token/menit. Satu penilaian ±2–3K token (prompt sistem saja ±1K),
# jadi 20 detik per panggilan ≈ 3 panggilan/menit, aman di bawah batas.
GROQ_MIN_INTERVAL_S = 20.0
_last_call = 0.0


# --------------------------------------------------------------------------- kunci API

def _read_dotenv() -> dict[str, str]:
    path = BASE_DIR / ".env"
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def use_keys(*, groq_env: str = "") -> dict[str, bool]:
    """Pasang kunci dari .env untuk notebook ini dan kembalikan mana yang tersedia.

    Groq memakai variabel khusus notebook (mis. GROQ_API_KEY_E1), lalu GROQ_API_KEY umum.
    Kode produksi membaca GROQ_API_KEY dan WINSTON_API_KEY, jadi keduanya di-set di sini.
    Isi kunci tidak pernah dicetak karena keluaran notebook ikut masuk git.
    """
    env = {**_read_dotenv(), **os.environ}
    groq_key = (env.get(groq_env, "") if groq_env else "") or env.get("GROQ_API_KEY", "")
    winston_key = env.get("WINSTON_API_KEY", "")
    os.environ["GROQ_API_KEY"] = groq_key.strip()
    os.environ["WINSTON_API_KEY"] = winston_key.strip()
    keys = {"groq": bool(groq_key.strip()), "winston": bool(winston_key.strip())}
    print("Kunci:", ", ".join(f"{name} {'ada' if ok else 'kosong'}" for name, ok in keys.items()))
    return keys


# --------------------------------------------------------------------------- Groq

def groq_models() -> set[str]:
    response = requests.get(
        GROQ_MODELS_URL,
        headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"},
        timeout=30,
    )
    response.raise_for_status()
    return {item["id"] for item in response.json()["data"]}


def _pace() -> None:
    """Beri jarak minimal antar-panggilan Groq supaya tidak menabrak batas per menit."""
    global _last_call
    wait = _last_call + GROQ_MIN_INTERVAL_S - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last_call = time.monotonic()


def with_retry(fn, *args, tries: int = 5, **kwargs):
    """Ulangi hanya untuk batas laju dan galat server; galat lain langsung dilempar."""
    for attempt in range(tries):
        wait = 2 * 2**attempt + random.random()
        _pace()
        try:
            return fn(*args, **kwargs)
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            body = exc.response.text if exc.response is not None else ""
            if status == 429 and "per day" in body.lower():
                raise RuntimeError("Kuota harian Groq habis. Jalankan ulang besok; hasil tersimpan di cache.") from exc
            if status not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            # Groq memberi tahu berapa lama harus menunggu; mengulang lebih cepat hanya memperpanjang blokir.
            retry_after = exc.response.headers.get("retry-after", "") if exc.response is not None else ""
            if retry_after.replace(".", "", 1).isdigit():
                wait = max(wait, float(retry_after) + 1)
            print(f"  Groq {status}, tunggu {wait:.0f} detik (percobaan {attempt + 1}/{tries})")
        except requests.RequestException:
            if attempt == tries - 1:
                raise
        time.sleep(wait)


def groq_chat(prompt: str, model: str, *, temperature: float = 0.7, max_tokens: int = 1200) -> str:
    """Satu permintaan teks biasa ke Groq. Dipakai untuk membuat data uji, bukan untuk menilai."""
    response = requests.post(
        GROQ_CHAT_URL,
        headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            # Penalaran gpt-oss ikut memakan max_tokens; "low" menyisakan jatah untuk teksnya.
            **({"reasoning_effort": "low"} if model.startswith("openai/gpt-oss") else {}),
        },
        timeout=90,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"] or ""
    text = re.sub(r"<think>.*?(</think>|$)", "", text, flags=re.S)  # model penalaran; terpotong pun dibuang
    return text.strip()


# --------------------------------------------------------------------------- ukuran

def timed(fn, *args, **kwargs):
    """(hasil, detik)."""
    started = time.perf_counter()
    result = fn(*args, **kwargs)
    return result, time.perf_counter() - started


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Interval 95% untuk proporsi; tetap masuk akal pada n kecil, tidak seperti ±1,96·SE."""
    if n == 0:
        return (math.nan, math.nan)
    p = successes / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (max(0.0, centre - half), min(1.0, centre + half))


def quadratic_kappa(a: list[int], b: list[int], k: int = 6) -> float:
    """Kappa berbobot kuadrat untuk skala urut 1..k (meleset satu level dihukum ringan)."""
    n = len(a)
    if n == 0:
        return math.nan
    observed = [[0] * k for _ in range(k)]
    for x, y in zip(a, b):
        observed[x - 1][y - 1] += 1
    row = [sum(r) for r in observed]
    col = [sum(observed[i][j] for i in range(k)) for j in range(k)]
    num = den = 0.0
    for i in range(k):
        for j in range(k):
            weight = (i - j) ** 2 / (k - 1) ** 2
            num += weight * observed[i][j]
            den += weight * row[i] * col[j] / n
    return 1 - num / den if den else math.nan


def _ratio(a: float, b: float) -> float:
    return a / b if b else math.nan


def binary_metrics(tp: int, fp: int, tn: int, fn: int) -> dict[str, float]:
    """Keluarga F1 untuk deteksi AI; kelas positif = AI, FP = tulisan manusia yang dituduh."""
    precision, recall = _ratio(tp, tp + fp), _ratio(tp, tp + fn)
    return {
        "TP": tp, "FP": fp, "TN": tn, "FN": fn,
        "akurasi": _ratio(tp + tn, tp + fp + tn + fn),
        "presisi": precision,
        "recall (TPR)": recall,
        "spesifisitas (TNR)": _ratio(tn, tn + fp),
        "FPR (salah tuduh / manusia)": _ratio(fp, fp + tn),
        "FDR (salah tuduh / yang ditandai)": _ratio(fp, tp + fp),
        "FP / semua teks": _ratio(fp, tp + fp + tn + fn),
        "F1": _ratio(2 * precision * recall, precision + recall),
    }


def multiclass_report(truth: list[int], pred: list[int], labels: list[int]) -> tuple[list[dict], dict[str, float]]:
    """Presisi, recall, F1 per kelas, lalu rata-rata makro dan berbobot (support = jumlah label benar)."""
    rows = []
    for label in labels:
        tp = sum(t == label and p == label for t, p in zip(truth, pred))
        precision = _ratio(tp, sum(p == label for p in pred))
        recall = _ratio(tp, sum(t == label for t in truth))
        f1 = _ratio(2 * precision * recall, precision + recall) if tp else 0.0
        rows.append({"kelas": label, "presisi": precision, "recall": recall, "F1": f1,
                     "support": sum(t == label for t in truth)})
    total = sum(r["support"] for r in rows)
    present = [r for r in rows if r["support"]]
    summary = {
        "n": len(truth),
        "akurasi": _ratio(sum(t == p for t, p in zip(truth, pred)), len(truth)),
        "presisi makro": sum(0.0 if math.isnan(r["presisi"]) else r["presisi"] for r in present) / len(present),
        "recall makro": sum(r["recall"] for r in present) / len(present),
        "F1 makro": sum(r["F1"] for r in present) / len(present),
        "F1 berbobot": sum(r["F1"] * r["support"] for r in present) / total,
    }
    return rows, summary


# --------------------------------------------------------------------------- simpan

def results_dir(name: str) -> Path:
    path = RESULTS_DIR / name
    path.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    return path


def save_figure(fig, filename: str) -> Path:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=160, bbox_inches="tight")
    return path


def md_table(df) -> str:
    """Tabel Markdown tanpa dependensi tambahan (pandas.to_markdown butuh tabulate)."""
    frame = df if type(df.index).__name__ == "RangeIndex" else df.reset_index()
    header = "| " + " | ".join(map(str, frame.columns)) + " |"
    rule = "|" + "---|" * len(frame.columns)
    rows = ["| " + " | ".join(str(v) for v in row) + " |" for row in frame.itertuples(index=False)]
    return "\n".join([header, rule, *rows])


def write_summary(path: Path, title: str, sections: dict[str, str]) -> None:
    body = [f"# {title}", ""]
    for heading, text in sections.items():
        body += [f"## {heading}", "", text.strip(), ""]
    path.write_text("\n".join(body), encoding="utf-8")


def load_jsonl(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    rows = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
            rows[row["key"]] = row["value"]
        except (json.JSONDecodeError, KeyError):
            continue
    return rows


def append_jsonl(path: Path, key: str, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"key": key, "value": value}, ensure_ascii=False) + "\n")
