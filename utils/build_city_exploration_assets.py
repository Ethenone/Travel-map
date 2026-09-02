"""Prepare browser-friendly city exploration data from the private workbook.

The generated files contain city boundaries plus the numeric exploration level
only. They deliberately exclude the source workbook and unrelated private data.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT.parent / "database"

PROVINCES = {
    "11": "北京市", "12": "天津市", "13": "河北省", "14": "山西省",
    "15": "内蒙古自治区", "21": "辽宁省", "22": "吉林省", "23": "黑龙江省",
    "31": "上海市", "32": "江苏省", "33": "浙江省", "34": "安徽省",
    "35": "福建省", "36": "江西省", "37": "山东省", "41": "河南省",
    "42": "湖北省", "43": "湖南省", "44": "广东省", "45": "广西壮族自治区",
    "46": "海南省", "50": "重庆市", "51": "四川省", "52": "贵州省",
    "53": "云南省", "54": "西藏自治区", "61": "陕西省", "62": "甘肃省",
    "63": "青海省", "64": "宁夏回族自治区", "65": "新疆维吾尔自治区",
    "71": "台湾省", "81": "香港特别行政区", "82": "澳门特别行政区",
}


def normalize_code(value: object) -> str:
    if pd.isna(value):
        return ""
    digits = "".join(ch for ch in str(value).split(".")[0] if ch.isdigit())
    if digits.startswith("156") and len(digits) >= 9:
        digits = digits[-6:]
    return digits.zfill(6)[-6:]


def main() -> None:
    source_geojson = DATABASE / "中国_市.geojson"
    source_workbook = DATABASE / "途径市.xlsx"
    boundary_target = ROOT / "data" / "china_city_boundaries.geojson"
    seed_target = ROOT / "data" / "city_exploration_seed.json"

    geojson = json.loads(source_geojson.read_text(encoding="utf-8"))
    city_features = []
    for feature in geojson.get("features", []):
        source_properties = feature.get("properties", {})
        code = normalize_code(source_properties.get("gb", ""))
        if code == "000000":
            continue
        feature["properties"] = {
            "name": source_properties.get("name", ""),
            "code": code,
            "province": PROVINCES.get(code[:2], "其他地区"),
            "province_code": code[:2],
        }
        city_features.append(feature)
    geojson["features"] = city_features

    workbook = pd.read_excel(source_workbook, sheet_name=0)
    levels: dict[str, int] = {}
    for row in workbook.itertuples(index=False, name=None):
        if len(row) < 8:
            continue
        code = normalize_code(row[2])
        level = 0
        for candidate in range(1, 6):
            if not pd.isna(row[2 + candidate]):
                level = candidate
        if code:
            levels[code] = level

    boundary_target.write_text(
        json.dumps(geojson, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    seed_target.write_text(
        json.dumps({"version": 1, "levels": levels}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Prepared {len(geojson.get('features', []))} boundaries and {len(levels)} level rows")


if __name__ == "__main__":
    main()
