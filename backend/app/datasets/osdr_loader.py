"""Strict CSV normalisation for manually downloaded OSDR laboratory files.

This importer deliberately does not scrape OSDR at request time.  It accepts a
simple long-format CSV so source files can be reviewed and checksummed first.
"""
from __future__ import annotations

import csv
import hashlib
import math
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field

class NormalizedLabRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_code: str = Field(min_length=1)
    analyte: str = Field(min_length=1)
    value: float
    unit: str = Field(min_length=1)
    ref_low: float | None = None
    ref_high: float | None = None
    timepoint_label: str = Field(min_length=1)
    days_from_launch: float | None = None
    accession: str = Field(pattern=r"^OSD-\\d+$")
    source_file: str = Field(min_length=1)
    row_hash: str = Field(min_length=64, max_length=64)

def _number(value: str | None, field: str) -> float | None:
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ValueError(f"{field} is not numeric: {value!r}") from exc
    if not math.isfinite(parsed):
        raise ValueError(f"{field} is not finite")
    return parsed

def parse_long_csv(path: Path, accession: str) -> tuple[list[NormalizedLabRow], list[str]]:
    """Return valid rows and explicit rejection reasons; never coerce values."""
    rows, rejected = [], []
    with path.open(newline="", encoding="utf-8-sig") as stream:
        for line_number, raw in enumerate(csv.DictReader(stream), start=2):
            try:
                canonical = {str(k).strip().lower(): (v or "").strip() for k, v in raw.items() if k}
                payload = {
                    "subject_code": canonical.get("subject_code") or canonical.get("subject") or canonical.get("subject id"),
                    "analyte": canonical.get("analyte") or canonical.get("test") or canonical.get("measurement"),
                    "value": _number(canonical.get("value"), "value"),
                    "unit": canonical.get("unit"),
                    "ref_low": _number(canonical.get("ref_low") or canonical.get("reference_low"), "ref_low"),
                    "ref_high": _number(canonical.get("ref_high") or canonical.get("reference_high"), "ref_high"),
                    "timepoint_label": canonical.get("timepoint_label") or canonical.get("timepoint") or canonical.get("visit"),
                    "days_from_launch": _number(canonical.get("days_from_launch"), "days_from_launch"),
                    "accession": accession,
                    "source_file": path.name,
                }
                if payload["value"] is None:
                    raise ValueError("value is required")
                payload["row_hash"] = hashlib.sha256(repr(sorted(payload.items())).encode()).hexdigest()
                rows.append(NormalizedLabRow.model_validate(payload))
            except Exception as exc:
                rejected.append(f"{path.name}:{line_number}: {exc}")
    return rows, rejected
