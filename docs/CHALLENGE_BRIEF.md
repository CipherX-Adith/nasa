# ORBITCARE challenge brief reconciliation

## Scope and assumptions

This repository is aligned to the supplied task brief for the NASA Space Apps 2026 **Health Monitoring Software** challenge. The official pages were not supplied as readable text and are not fetched by the app. Consequently, exact organiser resource wording and any final dataset list must be confirmed before submission; see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

The reconciled goal is to gather astronaut health indicators and help an astronaut evaluate and act on their own status. It is an educational prototype, not a medical device; it never diagnoses, prescribes treatment, or grants flight clearance.

## Evidence sources in scope

| Accession / source | Intended use | Status |
| --- | --- | --- |
| OSD-575, Inspiration4 serum metabolic panel | Read-only reference laboratory cohort | Import-ready; no raw data bundled |
| OSD-569, Inspiration4 blood count / CBC | Read-only reference laboratory cohort | Import-ready; no raw data bundled |
| OSDR RadLab / ISS DosTel | Environmental radiation context | Not imported; official-resource confirmation required |

## Requirement-to-feature traceability

| Requirement | Implementation location |
| --- | --- |
| Personal median/MAD comparisons and insufficient-history handling | `backend/app/intelligence.py` |
| Keep real and simulated records visibly distinct | `Measurement.simulated`, `Measurement.source`, `LabResult.accession` |
| Locally ingest, checksum, and query OSDR data | `backend/app/datasets/`, `/api/datasets*`, `backend/data/osdr/MANIFEST.json` |
| No request-time scraping | `backend/app/datasets/import_osdr.py` |
| Dataset provenance and laboratory ranges | `docs/DATA_PROVENANCE.md`, `LabResult.ref_low/ref_high` |
| Safer environment/configuration | `backend/app/core.py`, `backend/app/main.py`, `backend/.env.example` |
| Animated data-driven digital twin | `src/components/DigitalTwinViewer.tsx`, `src/App.tsx` |
| Astronaut self-evaluation/action requirement | Existing assessments/countermeasures; action-log expansion remains open |

