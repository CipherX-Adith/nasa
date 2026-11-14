# ORBITCARE

An integrated astronaut health intelligence and decision-support prototype. It combines simulated telemetry, self-reported assessments, medical report text extraction, personal baselines, deterministic alerts, a mission timeline, and a project-data-grounded assistant. This is not a clinically validated product; demo records are labeled simulated and alerts are not diagnoses.

## Requirements

- Python 3.10+
- Node.js 20+

## Start the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

The API documentation is available at http://localhost:8000/docs. On first startup it creates `backend/orbitcare.db` and seeds three simulated astronauts with mission history.

Demo logins use password `orbitcare-demo`:

- Medical officer: `medical`
- Astronaut: `astronaut`

To enable Gemini, add `GEMINI_API_KEY` to `backend/.env` and restart the backend. Without it, the assistant returns a local evidence retrieval response and all other functionality remains available. PDF text extraction uses PyMuPDF; scanned PDFs are retained with a low confidence indicator and require human review because OCR is not configured.

## Start the frontend

From the repository root:

```powershell
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies no requests: the frontend calls the local backend at `http://localhost:8000/api`.

## Functional areas

- JWT login with medical officer and astronaut roles; astronaut users are limited to their own data.
- Five health domains, sourced measurements, timestamps, quality flags, and explicit simulation labels.
- Robust median/MAD personal baselines (minimum five historical observations).
- Deterministic deviations and persistence signals; alert severity is independent of Gemini.
- Medical officer acknowledgement with persistent follow-up notes.
- PDF text extraction with confidence and verification state.
- Chronological mission timeline for telemetry, assessments, reports, and alerts.
- Gemini assistant retrieval from project records, with a local fallback.

## Tests

Run backend checks from `backend`:

```powershell
pytest
```

The demonstration scenario uses illustrative values only (including heart rate 65→82 bpm, HRV 65→42 ms, sleep 7.5→5 hours, and fatigue 2→7/10); these are not clinical thresholds.
