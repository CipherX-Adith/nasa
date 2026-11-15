# Data provenance

ORBITCARE starts in synthetic-only mode when no local OSDR files are present. Synthetic values are marked `simulated: true` and source-labeled; they must not be represented as NASA telemetry.

## Manual OSDR import

1. Download the organiser-approved OSDR files manually from [OSDR](https://osdr.nasa.gov/). Confirm the relevant accession, licence, citation, and data dictionary first.
2. Place each reviewed CSV in `backend/data/osdr/`. Do not commit raw files unless redistribution is authorised.
3. Add its accession, filename, SHA-256, title, citation, and source URL to `MANIFEST.json`.
4. Supply a long CSV with `subject_code`, `analyte`, `value`, `unit`, `ref_low`, `ref_high`, `timepoint_label`, and optionally `days_from_launch`.
5. Run `python -m app.datasets.import_osdr` from `backend`. The importer rejects invalid numeric rows rather than coercing them. It is idempotent by source-row hash.

Laboratory reference ranges are the source laboratory's terrestrial ranges. They are context only, never spaceflight limits or diagnostic thresholds. Reference data is small-n and descriptive; no population modelling or diagnosis is performed.

