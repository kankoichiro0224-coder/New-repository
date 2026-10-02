#!/usr/bin/env python3
"""Fetch Nikkei VI and CNN Fear & Greed history and write web/data/latest.json.

Standard library only. Usage:
    python fetcher/fetch_data.py            # live data (needs internet)
    python fetcher/fetch_data.py --sample   # synthetic demo data (offline)
"""
import argparse
import csv
import io
import json
import math
import random
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

NIKKEI_VI_URL = "https://indexes.nikkei.co.jp/nkave/historical/nikkei_stock_average_vi_daily_jp.csv"
CNN_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{start}"
UA = "Mozilla/5.0 (compatible; market-weather-map/1.0)"
OUT = Path(__file__).resolve().parent.parent / "web" / "data" / "latest.json"


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def decode_csv(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def parse_date(s: str):
    s = s.strip().replace("/", "-")
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_nikkei_vi(text: str):
    """CSV columns: date, close, open, high, low (header row in Japanese)."""
    rows = []
    for rec in csv.reader(io.StringIO(text)):
        if len(rec) < 2:
            continue
        d = parse_date(rec[0])
        if d is None:  # header / footer
            continue
        try:
            close = float(rec[1].replace(",", ""))
        except ValueError:
            continue
        rows.append({"date": d.isoformat(), "close": close})
    rows.sort(key=lambda r: r["date"])
    return rows


def parse_cnn(payload: dict):
    rows = {}
    for p in payload["fear_and_greed_historical"]["data"]:
        d = datetime.fromtimestamp(p["x"] / 1000, tz=timezone.utc).date().isoformat()
        rows[d] = {"date": d, "score": round(float(p["y"]), 1), "rating": p.get("rating", "")}
    return [rows[k] for k in sorted(rows)]


def rating(score: float) -> str:
    if score < 25: return "extreme fear"
    if score < 45: return "fear"
    if score <= 55: return "neutral"
    if score <= 75: return "greed"
    return "extreme greed"


def sample_data(days: int = 365):
    """Deterministic synthetic series for offline demos. NOT real market data."""
    rnd = random.Random(42)
    vi, fg, v, f = [], [], 22.0, 50.0
    d = date.today() - timedelta(days=days)
    while d <= date.today():
        if d.weekday() < 5:
            v = max(12.0, v + 0.08 * (20 - v) + rnd.gauss(0, 1.1) + (rnd.random() < 0.02) * 8)
            f = min(98.0, max(2.0, f + 0.05 * (50 - f) - 0.9 * (v - 20) * 0.05 + rnd.gauss(0, 3)))
            vi.append({"date": d.isoformat(), "close": round(v, 2)})
            fg.append({"date": d.isoformat(), "score": round(f, 1), "rating": rating(f)})
        d += timedelta(days=1)
    return vi, fg


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true", help="write synthetic demo data")
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args()

    if a.sample:
        vi, fg = sample_data(a.days)
        mode = "sample"
    else:
        start = (date.today() - timedelta(days=a.days)).isoformat()
        vi = parse_nikkei_vi(decode_csv(http_get(NIKKEI_VI_URL)))
        cutoff = start
        vi = [r for r in vi if r["date"] >= cutoff]
        fg = parse_cnn(json.loads(http_get(CNN_URL.format(start=start))))
        mode = "live"
    if not vi or not fg:
        print("error: empty series", file=sys.stderr)
        return 1

    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "sources": {"nikkei_vi": NIKKEI_VI_URL, "fear_greed": "CNN Fear & Greed Index"},
        "nikkei_vi": vi,
        "fear_greed": fg,
    }, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {a.out} ({mode}): VI={len(vi)} rows, F&G={len(fg)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
