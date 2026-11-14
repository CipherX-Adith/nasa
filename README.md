# ORBITCARE

ORBITCARE is a prototype astronaut health monitoring and decision-support application. It combines simulated mission telemetry, astronaut self-reports, personal baselines, deterministic deviation flags, medical document review, daily data summaries, a mission timeline, a countermeasure check-in list, and a record-grounded assistant. It is not a clinically validated product, does not diagnose, and does not make flight-clearance decisions.

## Requirements

- Python 3.10+
- Node.js 20+

## Run locally

In PowerShell, from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

In a second terminal from the repository root:

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The backend API and interactive docs are at http://localhost:8000 and http://localhost:8000/docs. SQLite persists to `backend/orbitcare.db` when started from `backend`. Set `DATABASE_URL` to a managed database for deployments; local SQLite files may not persist on serverless hosts.

The fresh local demo seeds three simulated astronauts in **Mars Transit — Day 42**. Maya Chen's sample includes resting heart rate 65→82 BPM, HRV 65→42 ms, sleep 7.5→5 hours and fatigue 2→7/10. These values are illustrative demo data. Demo logins use password `orbitcare-demo`: `medical` (medical officer), `maya` / `astronaut` (Maya), `elena`, and `david`. Change credentials and the local demo `SECRET_KEY` before any deployment.

## Configuration

- **Gemini:** set `GEMINI_API_KEY` in `backend/.env` to enable live model responses. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. Without a key, the assistant uses local record retrieval and displays `LOCAL FALLBACK MODE`. The key is used only by the backend.
- **Scanned PDF OCR (optional):** install `pip install -r requirements-ocr.txt` from `backend`, then install the Tesseract executable separately and ensure it is on `PATH` (or configure pytesseract's executable path). Without those pieces, selectable PDF text extraction still works and scanned PDFs are stored with OCR unavailable status for manual review.
- **Firebase (optional):** backend sync is disabled unless both `FIREBASE_DATABASE_URL` and `FIREBASE_DATABASE_SECRET` are configured. Firebase is not used as the source of user identities, roles, or password hashes. Use restrictive database rules and a least-privilege credential.
- **CORS:** add deployed frontend origins as a comma-separated `FRONTEND_ORIGINS` value. Avoid wildcard origins.
- **Production:** set a strong unique `SECRET_KEY`; production startup fails when it is missing. Configure an external persistent `DATABASE_URL` where the host does not preserve files.

## Included workflows

- JWT authentication and role checks for astronaut and medical-officer endpoints.
- Astronaut private data isolation; astronauts submit only their own self-reports and checklist updates.
- Robust median/MAD personal baselines with insufficient-history handling and quality exclusions.
- Deterministic, deduplicated deviation alerts with an explanation and source measurement.
- Explicit source, timestamp, and simulated-data flags.
- Medical-only PDF upload with selectable text extraction and optional OCR; parsed observations remain pending until a medical officer reviews, edits, approves, or rejects each candidate.
- Database-persisted daily checklist check-ins with date-based history; the entries are illustrative, self-reported and have no prescribed duration or dose.
- Prototype monitoring coverage, baseline comparisons, missing-data listing, and separate deviation flags. Coverage is not a clinical score or clearance.
- Local evidence assistant and optional backend-only Gemini responses with citations.
- Audit events for key record, alert, clearance, observation-review, and checklist actions. Audit entries do not duplicate medical content.

## Tests and build

From `backend`, run `pytest -q`. From the repository root, run `npm run build`.

## Limitations

- Demo sensor and self-report data are simulated. The display's live refresh reads the latest stored sample; no real spacecraft telemetry adapter is included.
- OCR relies on local Tesseract and can produce errors; extracted values must be checked against the source document. This prototype does not interpret reference ranges as diagnoses.
- Gemini mode requires an available API key/model and network access; the local assistant remains available when Gemini is unavailable.
- The app has not been independently security audited and does not claim regulatory compliance, encryption at rest, or clinical validation.
- Existing databases created before this update receive additive SQLite column migrations. The Mars Transit demo seed is only inserted into an empty database; existing data is not overwritten.
