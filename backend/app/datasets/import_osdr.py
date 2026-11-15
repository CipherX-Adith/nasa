"""Import local, checksummed OSDR CSV files: python -m app.datasets.import_osdr."""
from __future__ import annotations
import json
from pathlib import Path
from sqlalchemy import select
from ..db import Base, engine, SessionLocal
from ..models import ReferenceDataset, ReferenceSubject, LabResult
from .osdr_loader import parse_long_csv

ROOT = Path(__file__).resolve().parents[2] / "data" / "osdr"

def import_osdr() -> dict:
    manifest_path = ROOT / "MANIFEST.json"
    if not manifest_path.exists():
        raise FileNotFoundError("No OSDR manifest found. See docs/DATA_PROVENANCE.md for manual download steps.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    loaded = 0
    with SessionLocal() as db:
        Base.metadata.create_all(bind=engine)
        for item in manifest.get("datasets", []):
            file_path = ROOT / item["filename"]
            if not file_path.exists():
                raise FileNotFoundError(f"Missing {file_path.name}; no data was imported.")
            dataset = db.scalar(select(ReferenceDataset).where(ReferenceDataset.accession == item["accession"]))
            if not dataset:
                dataset = ReferenceDataset(**{key: item.get(key, "") for key in ("accession", "title", "citation", "url", "sha256")})
                db.add(dataset); db.flush()
            rows, rejected = parse_long_csv(file_path, item["accession"])
            if rejected:
                raise ValueError("OSDR import rejected rows: " + "; ".join(rejected[:10]))
            existing = {row[0] for row in db.execute(select(LabResult.row_hash).where(LabResult.accession == item["accession"]))}
            for row in rows:
                if row.row_hash in existing: continue
                db.add(LabResult(dataset_id=dataset.id, **row.model_dump()))
                if not db.scalar(select(ReferenceSubject).where(ReferenceSubject.dataset_id == dataset.id, ReferenceSubject.code == row.subject_code)):
                    db.add(ReferenceSubject(dataset_id=dataset.id, code=row.subject_code, label=f"Reference crew {row.subject_code}"))
                loaded += 1
        db.commit()
    return {"loaded": loaded}

if __name__ == "__main__": print(import_osdr())
