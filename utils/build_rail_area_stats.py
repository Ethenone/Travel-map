# -*- coding: utf-8 -*-
"""Build railway city/province coverage statistics for the dashboard."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


REFERENCE_DATA = Path(__file__).resolve().parents[1] / "reference-data"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    return parser.parse_args()


def main():
    args = parse_args()
    station_file = REFERENCE_DATA / "stations_data.csv"
    charts_file = args.output / "charts.json"

    with station_file.open(encoding="utf-8", newline="") as source:
        station_rows = list(csv.DictReader(source))
    charts = json.loads(charts_file.read_text(encoding="utf-8"))
    visited = charts.get("stationcount", {})

    city_stations = defaultdict(set)
    province_cities = defaultdict(set)
    province_stations = defaultdict(set)
    station_area = {}
    for row in station_rows:
        station = str(row.get("车站") or "").strip()
        province = str(row.get("省") or "").strip()
        city = str(row.get("市") or "").strip()
        if not station or not province or not city:
            continue
        area = (province, city)
        station_area[station] = area
        city_stations[area].add(station)
        province_cities[province].add(city)
        province_stations[province].add(station)

    city_visited_stations = defaultdict(set)
    city_visits = defaultdict(int)
    province_visited_stations = defaultdict(set)
    province_visited_cities = defaultdict(set)
    province_visits = defaultdict(int)
    unmatched = []

    for station, values in visited.items():
        area = station_area.get(station)
        if area is None:
            unmatched.append(station)
            continue
        province, city = area
        visits = int(values.get("total") or 0)
        city_visited_stations[area].add(station)
        city_visits[area] += visits
        province_visited_stations[province].add(station)
        province_visited_cities[province].add(city)
        province_visits[province] += visits

    cities = []
    for (province, city), stations in city_stations.items():
        visited_stations = city_visited_stations[(province, city)]
        cities.append({
            "province": province,
            "city": city,
            "visited_stations": len(visited_stations),
            "total_stations": len(stations),
            "visits": city_visits[(province, city)],
        })
    cities.sort(key=lambda row: (-row["visits"], -row["visited_stations"], row["province"], row["city"]))

    provinces = []
    for province, cities_in_province in province_cities.items():
        provinces.append({
            "province": province,
            "visited_cities": len(province_visited_cities[province]),
            "total_cities": len(cities_in_province),
            "visited_stations": len(province_visited_stations[province]),
            "total_stations": len(province_stations[province]),
            "visits": province_visits[province],
        })
    provinces.sort(key=lambda row: (-row["visits"], -row["visited_cities"], row["province"]))

    payload = {
        "summary": {
            "station_directory_count": len(station_area),
            "city_count": len(city_stations),
            "province_count": len(province_cities),
            "visited_station_count": len(visited),
            "unmatched_visited_station_count": len(unmatched),
        },
        "cities": cities,
        "provinces": provinces,
        "unmatched_visited_stations": sorted(unmatched),
    }
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "rail_area_stats.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(cities)} city rows and {len(provinces)} province rows to {target}")


if __name__ == "__main__":
    main()
