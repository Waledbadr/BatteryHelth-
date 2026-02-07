import argparse
import json
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import List, Optional, Tuple


REPORT_FILENAME = "battery-report.html"


@dataclass
class BatteryInfo:
    name: Optional[str]
    manufacturer: Optional[str]
    chemistry: Optional[str]
    design_capacity_mwh: Optional[int]
    full_charge_capacity_mwh: Optional[int]
    cycle_count: Optional[int]


@dataclass
class CapacityHistoryEntry:
    date: str
    full_charge_capacity_mwh: Optional[int]
    design_capacity_mwh: Optional[int]


def run_battery_report(output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / REPORT_FILENAME
    cmd = ["powercfg", "/batteryreport", f"/output", str(report_path)]
    subprocess.run(cmd, check=True)
    return report_path


def _clean_html(text: str) -> str:
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _find_label_value(html: str, label: str) -> Optional[str]:
    pattern = re.compile(
        rf"{re.escape(label)}\s*</td>\s*<td[^>]*>(.*?)</td>",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(html)
    if not match:
        return None
    return _clean_html(match.group(1))


def _extract_section(html: str, title: str) -> Optional[str]:
    section_pattern = re.compile(
        rf"{re.escape(title)}\s*</h2>\s*(<table.*?</table>)",
        re.IGNORECASE | re.DOTALL,
    )
    match = section_pattern.search(html)
    if not match:
        return None
    return match.group(1)


def _parse_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else None


def _parse_capacity_history(html: str) -> List[CapacityHistoryEntry]:
    table_html = _extract_section(html, "Battery capacity history")
    if not table_html:
        return []

    row_pattern = re.compile(r"<tr>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
    cell_pattern = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.IGNORECASE | re.DOTALL)

    entries: List[CapacityHistoryEntry] = []
    for row in row_pattern.findall(table_html):
        cells = [_clean_html(cell) for cell in cell_pattern.findall(row)]
        if len(cells) < 3 or cells[0].lower() == "period":
            continue
        date = cells[0]
        full_charge = _parse_int(cells[1])
        design = _parse_int(cells[2])
        entries.append(
            CapacityHistoryEntry(
                date=date,
                full_charge_capacity_mwh=full_charge,
                design_capacity_mwh=design,
            )
        )
    return entries


def _parse_system_info(html: str) -> dict:
    system_name = _find_label_value(html, "System Product Name")
    bios = _find_label_value(html, "BIOS")
    os_build = _find_label_value(html, "OS build")
    report_time = _find_label_value(html, "Report Time")
    return {
        "product": system_name,
        "bios": bios,
        "os_build": os_build,
        "report_time": report_time,
    }


def parse_battery_report(report_path: Path) -> Tuple[dict, BatteryInfo, List[CapacityHistoryEntry]]:
    html = report_path.read_text(encoding="utf-8", errors="ignore")

    name = _find_label_value(html, "Name")
    manufacturer = _find_label_value(html, "Manufacturer")
    chemistry = _find_label_value(html, "Chemistry")
    design_capacity = _parse_int(_find_label_value(html, "Design Capacity"))
    full_charge_capacity = _parse_int(_find_label_value(html, "Full Charge Capacity"))
    cycle_count = _parse_int(_find_label_value(html, "Cycle Count"))

    system_info = _parse_system_info(html)

    battery_info = BatteryInfo(
        name=name,
        manufacturer=manufacturer,
        chemistry=chemistry,
        design_capacity_mwh=design_capacity,
        full_charge_capacity_mwh=full_charge_capacity,
        cycle_count=cycle_count,
    )

    history = _parse_capacity_history(html)

    return system_info, battery_info, history


def compute_health(battery: BatteryInfo) -> dict:
    if not battery.design_capacity_mwh or not battery.full_charge_capacity_mwh:
        health_pct = None
    else:
        health_pct = round(
            (battery.full_charge_capacity_mwh / battery.design_capacity_mwh) * 100,
            2,
        )
    degradation_pct = None
    if health_pct is not None:
        degradation_pct = round(100 - health_pct, 2)

    cycle_penalty = 0
    if battery.cycle_count and battery.cycle_count > 500:
        cycle_penalty = min(15, (battery.cycle_count - 500) // 50)

    estimated_remaining_life = "unknown"
    if health_pct is not None:
        if health_pct >= 85:
            estimated_remaining_life = "18-24 months"
        elif health_pct >= 70:
            estimated_remaining_life = "12-18 months"
        elif health_pct >= 60:
            estimated_remaining_life = "6-12 months"
        else:
            estimated_remaining_life = "0-6 months"

    return {
        "health_percentage": health_pct,
        "degradation_percentage": degradation_pct,
        "cycle_penalty": cycle_penalty,
        "estimated_remaining_life": estimated_remaining_life,
    }


def build_payload(system_info: dict, battery: BatteryInfo, history: List[CapacityHistoryEntry]) -> dict:
    health = compute_health(battery)

    payload = {
        "system": system_info,
        "battery": {
            "name": battery.name,
            "manufacturer": battery.manufacturer,
            "chemistry": battery.chemistry,
            "design_capacity_mwh": battery.design_capacity_mwh,
            "full_charge_capacity_mwh": battery.full_charge_capacity_mwh,
            "cycle_count": battery.cycle_count,
        },
        "health": health,
        "history": [
            {
                "date": entry.date,
                "full_charge_capacity_mwh": entry.full_charge_capacity_mwh,
                "design_capacity_mwh": entry.design_capacity_mwh,
            }
            for entry in history
        ],
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Windows Battery Health Agent")
    parser.add_argument(
        "--output-dir",
        default=str(Path.cwd()),
        help="Directory to save the battery report and JSON output.",
    )
    parser.add_argument(
        "--report-path",
        default=None,
        help="Existing battery-report.html path to parse instead of generating.",
    )
    parser.add_argument(
        "--json-output",
        default="battery-data.json",
        help="Name of the JSON output file.",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    report_path = Path(args.report_path) if args.report_path else None

    if report_path is None:
        report_path = run_battery_report(output_dir)

    system_info, battery_info, history = parse_battery_report(report_path)
    payload = build_payload(system_info, battery_info, history)

    json_path = output_dir / args.json_output
    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    print(f"Battery data written to {json_path}")


if __name__ == "__main__":
    main()
