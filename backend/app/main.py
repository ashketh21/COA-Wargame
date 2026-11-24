"""FastAPI entrypoint for the CAF COA Wargame & JISR Decision Support API."""

from pathlib import Path
from typing import Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .engine import adjudicate_turn
from .models import (
    CoaSimulationRequest,
    CoaSimulationResponse,
    GameState,
    TurnStepRequest,
    UnitOrder,
)
from .monte_carlo import recommend_blue_orders, run_monte_carlo_coa
from .scenario import create_initial_scenario

app = FastAPI(
    title="CAF COA Wargame & JISR Decision Support API",
    version="0.1.0",
    description="Headless wargaming adjudication and Monte Carlo COA evaluation engine.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint for cloud deployment platforms."""
    return {"status": "ok"}


@app.get("/api/scenario", response_model=GameState)
def get_initial_scenario() -> GameState:
    """Return the initial Operation REASSURANCE tactical scenario."""
    return create_initial_scenario()


@app.post("/api/step", response_model=GameState)
def step_turn(req: TurnStepRequest) -> GameState:
    """Adjudicate a single Action-Reaction-Counteraction turn."""
    return adjudicate_turn(req.state, req.blue_orders)


@app.post("/api/simulate-coa", response_model=CoaSimulationResponse)
def simulate_coa(req: CoaSimulationRequest) -> CoaSimulationResponse:
    """Execute N Monte Carlo wargame rollouts to evaluate the planned Blue COA."""
    return run_monte_carlo_coa(req)


@app.post("/api/recommend-orders", response_model=Dict[str, UnitOrder])
def get_recommended_orders(state: GameState) -> Dict[str, UnitOrder]:
    """Return Utility-AI recommended Blue orders for the current board state."""
    return recommend_blue_orders(state)


# Serve built React/Vite frontend when deployed as a single container
_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    _assets_dir = _FRONTEND_DIST / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = _FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
