"""Compare the site's per-model counts with the manually grouped model list."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook


def normalize(name):
    return str(name).replace(" ", "").replace("—", "-").replace("（", "(").replace("）", ")")


# The user's summary groups some body styles and batches under one model name.
# Detector cars and incomplete trainsets are included only where that was
# already the summary's convention.
ALIASES = {
    "CR400AF(样车)": "CR400AF", "CR400AF(双控)": "CR400AF",
    "CR400AF-G(原可变轨距)": "CR400AF-G",
    "CR400AF-AE(二阶段)": "CR400AF-AE",
    "CR400BF(样车)": "CR400BF", "CR400BF(原可变轨距)": "CR400BF",
    "CR400BF-G(原可变轨距)": "CR400BF-G",
    "CR400BF-C(冬奥版)": "CR400BF-C",
    "CR400BF-Z(亚运版)": "CR400BF-Z",
    "CR300AF(样车)": "CR300AF", "CR300BF(样车)": "CR300BF",
    "CR200J1(样车)": "CR200J1-A",
    "CR200J1(长编组样车)": "CR200J1-A",
    "CR200J1-A(长编组)": "CR200J1-A",
    "CR200J2(样车)": "CR200J2-A",
    "CR200J2(长编组样车)": "CR200J2-A",
    "CR200J3(样车)": "CR200J3-A",
    "CR200J3(长编组样车)": "CR200J3-A",
    "CR200J3-A(长编组)": "CR200J3-A",
    "CR200J3-B(跨国版)": "CR200J3-B",
    "CR200J1-C(18编组)": "CR200J1-C",
    "CR200J2-C(18编组)": "CR200J2-C",
    "CR200J3-C(18编组)": "CR200J3-C",
    "CR200J3-C(19编组)": "CR200J3-C",
    "CRH380A(统型)": "CRH380A", "CRH380A(港铁)": "CRH380A-HK",
    "CRH380AL(一阶段)": "CRH380AL", "CRH380AL(二阶段)": "CRH380AL",
    "CRH380AL(三阶段)": "CRH380AL",
    "CRH380BG(统型)": "CRH380BG",
    "CRH380BL(一阶段)": "CRH380BL", "CRH380BL(二阶段)": "CRH380BL",
    "CRH380BL(三阶段)": "CRH380BL",
    "CRH380D(统型)": "CRH380D",
    "CRH1A-200": "CRH1A", "CRH1A-250": "CRH1A",
    "CRH1B(1E头型)": "CRH1B", "CRH1E(NG)": "CRH1E",
    "CRH2A(综合检测车)": "CRH2A", "CRH2A(统型)": "CRH2A",
    "CRH2B(2A头型)": "CRH2B",
    "CRH2C(一阶段)": "CRH2C", "CRH2C(二阶段)": "CRH2C",
    "CRH2E(NG高寒)": "CRH2E", "CRH2E(NG)": "CRH2E",
    "CRH2E(纵向)": "CRH2E", "CRH2G(技术提升型)": "CRH2G",
    "CRH3C(一阶段)": "CRH3C", "CRH3C(二阶段)": "CRH3C",
    "CRH3A(城际版)": "CRH3A-CJ1",
    "CJ2": "CRH3G-CJ2", "CJ3": "CRH3F-CJ3",
    "CRH5G(大功率)": "CRH5G", "CRH5G(技术提升型)": "CRH5G",
    "CRH6A(中期)": "CRH6A", "CRH6A(后期)": "CRH6A",
    "CRH6A(舒适版)": "CRH6A", "CRH6A(智能版)": "CRH6A",
    "CRH6A-A(智能版)": "CRH6A-A", "CRH6A-A(2.0)": "CRH6A-A",
    "CRH6F(2.0)": "CRH6F", "CRH6F-A(智能版)": "CRH6F-A",
    "CRH6F-A(2.0)": "CRH6F-AZ",
    "CJ6(样车)": "CJ6",
}


# Clearly named new models; the rest of the website catalogue remains visible
# in the source-detail sheet for review, rather than being silently imported.
NEW_GROUPS = {
    "CR450AF(样车)": "CR450AF", "CR450BF(样车)": "CR450BF",
    "CR400AF-X": "CR400AF-X", "CR400AF-AX": "CR400AF-AX",
    "CR400BF-X": "CR400BF-X", "CR400BF-AX": "CR400BF-AX",
    "CR400BF-GX": "CR400BF-GX",
    "CR300AF-H": "CR300AF-H", "CR300BF-H": "CR300BF-H",
    "CR220J1-H": "CR220J1-H", "CR220J3-H": "CR220J3-H",
    "CRH3X": "CRH3X",
}


def prepare(snapshot_path, workbook_path):
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    workbook = load_workbook(workbook_path, read_only=True, data_only=True)
    original = []
    for row in workbook["车型列表"].iter_rows(min_row=2, values_only=True):
        if isinstance(row[0], str) and isinstance(row[1], (int, float)):
            original.append({"model": row[0].strip(), "old_count": row[1], "rarity": row[3] or ""})
    existing = {normalize(row["model"]): row["model"] for row in original}

    groups = defaultdict(list)
    details = []
    for model in snapshot["models"]:
        key = normalize(model["name"])
        group = ALIASES.get(key) or existing.get(key) or NEW_GROUPS.get(key)
        count = model["count"]
        # Fractions are incomplete trainsets and are not whole-set counts.
        included = group is not None and count is not None and count >= 1 and count == int(count)
        record = {**model, "group": group or "", "included": included}
        details.append(record)
        if included:
            groups[group].append(record)

    summary = []
    for row in original:
        members = groups.get(row["model"], [])
        current = int(sum(item["count"] for item in members)) if members else None
        summary.append({**row, "site_count": current,
                        "delta": current - row["old_count"] if current is not None else None,
                        "status": "网站未对应" if current is None else
                                  "增加" if current > row["old_count"] else
                                  "减少" if current < row["old_count"] else "不变",
                        "site_parts": ", ".join(f"{x['name']} {int(x['count'])}" for x in members)})
    for group in NEW_GROUPS.values():
        if group in {row["model"] for row in summary}:
            continue
        members = groups.get(group, [])
        if members:
            summary.append({"model": group, "old_count": None, "rarity": "",
                            "site_count": int(sum(x["count"] for x in members)),
                            "delta": None, "status": "网站有·原表无",
                            "site_parts": ", ".join(f"{x['name']} {int(x['count'])}" for x in members)})
    return {"checked_on": snapshot["checked_on"], "site_url": snapshot["source"],
            "source_workbook": str(workbook_path), "summary": summary, "details": details}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    comparison = prepare(args.snapshot, args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(comparison, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Compared {len(comparison['summary'])} grouped models and {len(comparison['details'])} site entries")


if __name__ == "__main__":
    main()
