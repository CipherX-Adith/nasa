# 🚀 ORBITCARE

### AI-Powered Astronaut Health Monitoring & Clinical Decision-Support System

**Intelligent healthcare for astronauts on long-duration deep-space missions.**

ORBITCARE is an AI-powered astronaut health monitoring and clinical decision-support platform designed for long-duration space exploration.

Inspired by the challenges of a Mars transit mission, ORBITCARE addresses a critical problem in space medicine: communication delays between Earth and spacecraft can reach up to 22 minutes each way, making immediate ground-based medical assistance difficult during emergencies.

ORBITCARE provides an autonomous, edge-capable medical workstation that helps onboard Flight Surgeons monitor astronaut health, detect unusual physiological changes, review medical records, and support clinical decision-making.

The project is demonstrated through a simulated **Mars Transit — Day 42 / Asteria-7 mission**.

---

## 🌌 Key Features

### 1. Role-Based Health Monitoring

ORBITCARE provides separate workspaces for two user roles:

- **Medical Officers:** Monitor the entire crew, investigate health alerts, review medical documents, generate clinical reports, and evaluate astronaut readiness.
- **Astronauts:** Monitor personal health data, submit daily health assessments, track countermeasures, and interact with the AI assistant.

Each astronaut's medical information is isolated to protect individual privacy.

### 2. AI-Powered Anomaly Detection

Uses statistical intelligence to identify unusual changes in astronaut physiology.

- Establishes individual health baselines using Median and Median Absolute Deviation (MAD).
- Identifies significant deviations from personal baselines.
- Detects persistent physiological trends.
- Generates high- and medium-priority alerts.
- Reduces duplicate alerts to prevent alert fatigue.

Unlike systems that rely entirely on fixed population-wide thresholds, ORBITCARE considers individual physiological history.

### 3. Interactive Anatomical Digital Twin

An interactive holographic-style anatomical visualization that connects astronaut health data with five major physiological systems.

| Physiological System | Monitored Parameters                 |
| -------------------- | ------------------------------------ |
| Cardiovascular       | Heart rate, HRV, blood pressure      |
| Pulmonary            | SpO₂, respiration, cabin CO₂         |
| Neurocognitive       | Sleep, fatigue, circadian rhythm     |
| Musculoskeletal      | Grip strength, muscle condition      |
| Immune & Thermal     | Core temperature, radiation exposure |

Features include interactive anatomical inspection, zooming, panning, organ focus, and physiological stress indicators.

### 4. Medical Document Processing

Allows Flight Surgeons to upload PDF medical reports and extract clinical observations.

- Extracts text from PDF documents.
- Supports optional OCR for scanned documents.
- Identifies candidate laboratory observations.
- Places extracted results in a pending-review queue.
- Requires authorized medical approval before observations enter verified clinical records.

This human-in-the-loop approach prevents automatically extracted values from being treated as verified medical information.

### 5. Dual-Mode AI Health Assistant

ORBITCARE supports both connected and offline operation.

**Cloud AI — Google Gemini**

- Answers questions using astronaut-specific health information.
- Uses structured medical evidence as context.
- Provides evidence references in responses.
- Uses safety-constrained prompts to reduce unsupported medical claims.

**Offline Assistant**

- Uses a deterministic local rules-based engine.
- Works without an internet connection or Gemini API key.
- Answers questions about alerts, biometric trends, medical history, and mission timelines.

### 6. Daily Countermeasure Tracking

Astronauts can record their daily health-maintenance activities, including:

- Aerobic exercise.
- Resistive exercise (ARED).
- Hydration and electrolyte intake.
- Sleep and circadian management.

Medical Officers can monitor countermeasure compliance.

### 7. Secure Medical Records & Audit Trail

- JWT-based authentication.
- Password hashing.
- Role-based authorization.
- Astronaut-specific data isolation.
- Protected medical document verification.
- Audit logging of important clinical and administrative actions.

---

## 🏗️ Technology Stack

| Component           | Technologies                          |
| ------------------- | ------------------------------------- |
| Frontend            | React 19, TypeScript                  |
| Styling             | Tailwind CSS v4, Custom CSS           |
| Build Tool          | Vite                                  |
| Backend             | Python, FastAPI                       |
| Database            | SQLAlchemy, SQLite                    |
| Authentication      | JWT, bcrypt                           |
| AI Integration      | Google Gemini API                     |
| Intelligence Engine | Python, Statistical Anomaly Detection |
| Document Processing | PyPDF, Tesseract OCR, PyMuPDF         |
| Cloud Integration   | Firebase                              |
| Testing             | Pytest                                |
| Deployment          | Vercel                                |

---

## 📂 Project Structure

```text
nasa/
│
├── api/
│   └── index.py
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── intelligence.py
│   │   ├── core.py
│   │   ├── db.py
│   │   └── seed.py
│   │
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-ocr.txt
│
├── src/
│   ├── components/
│   │   └── DigitalTwinViewer.tsx
│   ├── App.tsx
│   ├── firebase.ts
│   ├── main.tsx
│   └── style.css
│
├── index.html
├── package.json
├── vite.config.ts
├── vercel.json
└── README.md
```

### Architecture Overview

- **Frontend:** Provides the interactive medical dashboard, astronaut workspaces, alerts, reports, and anatomical Digital Twin.
- **Backend:** Handles authentication, medical records, telemetry, clinical workflows, and API requests.
- **Intelligence Engine:** Processes physiological measurements, establishes personal baselines, and identifies anomalies.
- **AI Layer:** Provides Gemini-powered assistance with a deterministic offline fallback.
- **Database:** Stores astronaut profiles, measurements, alerts, assessments, and clinical records.
- **Optional Cloud Integration:** Firebase supports additional cloud synchronization.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+
- npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/CipherX-Adith/nasa.git
cd nasa
```

### 2. Start the Backend

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt

Copy-Item .env.example .env

uvicorn app.main:app --reload --port 8000
```

Backend API: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### 3. Start the Frontend

Open another terminal in the project root:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

### 4. Optional OCR Setup

For scanned medical documents:

```bash
cd backend
pip install -r requirements-ocr.txt
```

OCR functionality may also require installing the Tesseract OCR engine separately.

---

## 🛰️ Mission Simulation

**Mission:** Mars Transit — Day 42  
**Spacecraft:** Asteria-7

ORBITCARE includes a synthetic 42-day astronaut health dataset featuring three simulated crew members.

| Astronaut    | Mission Role       | Simulated Health Profile         |
| ------------ | ------------------ | -------------------------------- |
| Maya Chen    | Mission Commander  | Cardiovascular and fatigue drift |
| Elena Rossi  | Flight Engineer    | Nominal physiological baseline   |
| David Okafor | Payload Specialist | Nominal physiological baseline   |

### Example: Maya Chen's Physiological Changes

| Health Parameter       |   Initial |  Day 42 |
| ---------------------- | --------: | ------: |
| Resting Heart Rate     |    65 BPM |  82 BPM |
| Heart Rate Variability |     65 ms |   42 ms |
| Sleep Duration         | 7.5 hours | 5 hours |
| Fatigue                |      2/10 |    7/10 |

These simulated changes demonstrate how ORBITCARE identifies deviations, generates alerts, and provides supporting information for Flight Surgeon review.

---

## 🧪 Testing

Run backend tests:

```bash
cd backend
pytest -v
```

Build the frontend:

```bash
npm run build
```

The test suite covers authentication, role-based access, data privacy, anomaly detection, alert generation, document verification, and assistant functionality.

---

## 🔮 Future Scope

- Integration with real-time wearable health sensors.
- Advanced machine learning for predictive health monitoring.
- Improved onboard edge AI capabilities.
- More detailed 3D anatomical visualization.
- Enhanced radiation and environmental monitoring.
- Secure synchronization with Earth-based medical facilities.
- Advanced temporal anomaly detection.

---

## ⚠️ Disclaimer

ORBITCARE is an educational and research prototype built around a simulated space mission. It is not a clinically validated or certified medical device and does not replace professional medical judgment.

It does not independently diagnose medical conditions or make autonomous flight-clearance decisions. All simulated astronaut data is synthetic, and clinical decisions must remain under the supervision of authorized medical professionals.

---

## 🚀 Project Vision

**ORBITCARE — Bringing intelligent healthcare closer to the stars.**

Building a future where astronauts can receive intelligent, evidence-supported health monitoring and clinical assistance, even when Earth is millions of kilometers away.
