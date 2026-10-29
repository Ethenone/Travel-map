"""Save the model counts shown by the china-emu.cn all-models catalogue."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


SOURCE_URL = "https://www.china-emu.cn/Trains/ALL/"


def fetch_models():
    response = requests.get(SOURCE_URL, timeout=30)
    response.raise_for_status()
    page = BeautifulSoup(response.text, "html.parser")
    models = []
    for link in page.select('a[href*="/Trains/Model/Detail-"]'):
        card = link.find_parent("div", class_="series-list-box")
        count_node = card.select_one(".series-list-item-word2 .d-inline") if card else None
        count_text = count_node.get_text(" ", strip=True) if count_node else ""
        count_match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*组", count_text)
        models.append({
            "name": link.get_text(" ", strip=True),
            "count": float(count_match.group(1)) if count_match else None,
            "count_label": count_text,
            "url": urljoin(SOURCE_URL, link["href"]),
        })
    if len(models) < 200:
        raise ValueError(f"Catalogue returned only {len(models)} model records")
    return {"source": SOURCE_URL, "checked_on": date.today().isoformat(), "models": models}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    snapshot = fetch_models()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(snapshot['models'])} model records to {args.output}")


if __name__ == "__main__":
    main()
