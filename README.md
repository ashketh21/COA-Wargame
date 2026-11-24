# Tactical COA Wargame & Decision Support System

**Live Demo:** https://coawargame.up.railway.app

An interactive **Course of Action (COA) wargaming and JISR Decision-Support Sandbox** modelled on the **Canadian Armed Forces (CAF) Operational Planning Process (OPP)** and the **Operation REASSURANCE** Mission.

## Operational Scenario
Set along the **Daugava River** line in eastern Latvia under **Operation REASSURANCE**, you command forward elements of the **CAF-led NATO Multinational Brigade – Latvia (MNB-LVA)** (operating out of Camp Ādaži) defending the real georeferenced **Jēkabpils Bridge** and **Daugavpils Unity Bridge (Vienības tilts)** crossings—along with **FOB Sēlpils** on the west bank—against an advancing mechanized adversary (**Red**) over an 8-turn window.

## Key Capabilities
1. **Action – Reaction – Counteraction Turn Loop:** Doctrinal phase resolution (*Air/JISR Fusion → Indirect Fires → Ground Maneuver → Direct Contact → Mission Check*) with Victory/Defeat termination.
2. **Real Fog of War & JISR Fusion:** Hidden Red tracks (<25% confidence), unidentified SIGINT `?` contacts (25%–54%, subject to a -50% blind-fire penalty), and UAS-spotted artillery bonuses (+30% to +45%).
3. **Automated Monte Carlo COA Evaluator:** Runs $N=100$ headless stochastic rollouts over a 5-turn horizon in Python to compute Corridor Hold Probability, expected attrition, hex-level breach heatmaps, and tactical advisories before committing a turn.
4. **Georeferenced NATO APP-6D Map:** Authentic military unit icons rendered via `milsymbol` over a Leaflet OpenStreetMap layer aligned directly to the Daugava River corridor between Jēkabpils and Daugavpils.

## Architecture
- **`backend/` (Python + FastAPI + Pydantic):**
  - `app/main.py`: FastAPI REST endpoints (`/api/scenario`, `/api/step`, `/api/simulate-coa`, `/api/recommend-orders`).
  - `app/models.py`: Strict Pydantic schemas for hex tiles, units, orders, game status, and Monte Carlo COA reports.
  - `app/hex_math.py`: Axial hex grid distance and neighbor utilities.
  - `app/scenario.py`: Georeferenced Daugava River / Latgale Order of Battle (ORBAT) and terrain generator.
  - `app/engine.py`: Turn adjudication (river barrier, JISR sensor fusion, pre-maneuver fires, ground combat, SHORAD/EW attrition, Red doctrine AI, and Victory/Defeat checks).
  - `app/monte_carlo.py`: Headless Monte Carlo COA rollout engine and Utility-AI order advisor.
  - `tests/test_engine.py`: Pytest unit tests for adjudication, river/UAS rules, indirect fires, end-states, and Monte Carlo evaluation.
- **`frontend/` (TypeScript + React + Vite + TailwindCSS + Leaflet + Milsymbol):**
  - `src/App.tsx`: Command bar, Blue ORBAT tasking, unit-specific order controls, Monte Carlo COA analytics panel, and adjudication log.
  - `src/components/TacticalMap.tsx`: Georeferenced Leaflet + hex polygon overlay with NATO APP-6D icons, Fog of War contacts, valid-hex highlighting, and threat heatmaps.
  - `src/components/HowToPlayModal.tsx`: Interactive CAF OPP mission briefing and rules reference.
  - `src/types/wargame.ts`: TypeScript interfaces mirroring the backend API schemas.

## Quick Start

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000

# macOS / Linux
# source .venv/bin/activate
# pip install -r requirements.txt
# uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173/ (Vite proxies `/api` requests to `http://127.0.0.1:8000`).

## Running Tests & Build Checks
```bash
# Backend unit tests
cd backend && .\.venv\Scripts\pytest   # or `pytest` with venv activated

# Frontend type-check & production build
cd frontend && npm run build
```
