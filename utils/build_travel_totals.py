# -*- coding: utf-8 -*-
"""Add air travel totals to the generated dashboard statistics."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from openpyxl import load_workbook


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args()


def duration_minutes(value):
    if value is None:
        return 0.0
    if isinstance(value, dt.datetime):
        value = value.time()
    if isinstance(value, dt.time):
        return value.hour * 60 + value.minute + value.second / 60
    if isinstance(value, dt.timedelta):
        return value.total_seconds() / 60
    if isinstance(value, (int, float)):
        return float(value) * 24 * 60
    parts = str(value).strip().split(":")
    if len(parts) >= 2:
        return int(parts[0]) * 60 + int(parts[1]) + (float(parts[2]) / 60 if len(parts) > 2 else 0)
    return 0.0


def main():
    args = parse_args()
    workbook = load_workbook(args.database / "飞机乘坐记录.xlsx", read_only=True, data_only=True)
    sheet = workbook.worksheets[0]
    headers = [str(value or "").strip() for value in next(sheet.iter_rows(values_only=True))]
    header_index = {name: index for index, name in enumerate(headers) if name}
    required = ("航班号", "飞行时间", "飞行距离")
    missing = [name for name in required if name not in header_index]
    if missing:
        raise KeyError(f"Missing air travel columns: {', '.join(missing)}")

    trip_count = 0
    total_minutes = 0.0
    total_distance = 0.0
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row[header_index["航班号"]]:
            continue
        trip_count += 1
        total_minutes += duration_minutes(row[header_index["飞行时间"]])
        total_distance += float(row[header_index["飞行距离"]] or 0)
    workbook.close()

    total_minutes = int(round(total_minutes))
    total_distance = int(round(total_distance))

    foreign_workbook = load_workbook(args.database / "境外铁路乘坐记录.xlsx", read_only=True, data_only=True)
    foreign_sheet = foreign_workbook["乘坐列表"]
    foreign_headers = [str(value or "").strip() for value in next(foreign_sheet.iter_rows(values_only=True))]
    foreign_index = {name: index for index, name in enumerate(foreign_headers) if name}
    foreign_required = ("上车城市（英语）", "下车城市（英语）", "时长.1", "里程")
    foreign_missing_headers = [name for name in foreign_required if name not in foreign_index]
    if foreign_missing_headers:
        raise KeyError(f"Missing foreign railway columns: {', '.join(foreign_missing_headers)}")

    foreign_trips = 0
    foreign_minutes = 0.0
    foreign_distance = 0.0
    foreign_missing_time = 0
    foreign_missing_distance = 0
    for row in foreign_sheet.iter_rows(min_row=2, values_only=True):
        if not row[foreign_index["上车城市（英语）"]] or not row[foreign_index["下车城市（英语）"]]:
            continue
        foreign_trips += 1
        time_value = row[foreign_index["时长.1"]]
        distance_value = row[foreign_index["里程"]]
        if time_value is None:
            foreign_missing_time += 1
        else:
            foreign_minutes += duration_minutes(time_value)
        if distance_value is None:
            foreign_missing_distance += 1
        else:
            foreign_distance += float(distance_value)
    foreign_workbook.close()
    foreign_minutes = int(round(foreign_minutes))
    foreign_distance = int(round(foreign_distance))

    stats_file = args.output / "stats.json"
    stats = json.loads(stats_file.read_text(encoding="utf-8"))
    rail_minutes = (stats.get("total_time", [0, 0])[0] * 60) + stats.get("total_time", [0, 0])[1]
    stats.update({
        "air_total_trips": trip_count,
        "air_total_time_minutes": total_minutes,
        "air_total_time": list(divmod(total_minutes, 60)),
        "air_total_distance": total_distance,
        "foreign_rail_total_trips": foreign_trips,
        "foreign_rail_total_time_minutes": foreign_minutes,
        "foreign_rail_total_distance": foreign_distance,
        "foreign_rail_missing_time_trips": foreign_missing_time,
        "foreign_rail_missing_distance_trips": foreign_missing_distance,
        "combined_total_time_minutes": total_minutes + rail_minutes + foreign_minutes,
        "combined_total_distance": total_distance + int(stats.get("total_distance", 0)) + foreign_distance,
    })
    stats_file.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    hours, minutes = divmod(total_minutes, 60)
    print(f"Added air totals: {trip_count} trips, {hours}h {minutes}m, {total_distance} km")
    print(f"Foreign rail completeness: {foreign_trips - foreign_missing_time}/{foreign_trips} times, {foreign_trips - foreign_missing_distance}/{foreign_trips} distances")


if __name__ == "__main__":
    main()
