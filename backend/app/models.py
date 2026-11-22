from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class Faction(str, Enum):
    BLUE = "BLUE"  # CAF / NATO Battle Group
    RED = "RED"    # Opposing Force


class UnitType(str, Enum):
    MECH_INF = "MECH_INF"      # LAV 6.0 Mechanized Infantry
    ARMOR = "ARMOR"            # Leopard 2A4M Tank Squadron
    ISR_UAS = "ISR_UAS"        # CU-172 Blackjack / Tactical Recon
    ARTILLERY = "ARTILLERY"    # M777 155mm Howitzer Battery


class TerrainType(str, Enum):
    CLEAR = "CLEAR"
    FOREST = "FOREST"
    URBAN = "URBAN"
    RIVER = "RIVER"
    RIVER_BRIDGE = "RIVER_BRIDGE"
    HIGHWAY = "HIGHWAY"


class GameStatus(str, Enum):
    ACTIVE = "ACTIVE"
    VICTORY = "VICTORY"
    DEFEAT = "DEFEAT"


class OrderType(str, Enum):
    HOLD = "HOLD"              # Dig-in, +defense bonus
    MOVE = "MOVE"              # Advance to adjacent hex
    RECON_SWEEP = "RECON_SWEEP"  # Expand sensor detection radius
    FIRE_SUPPORT = "FIRE_SUPPORT"  # Indirect artillery strike on target hex


class RedDoctrine(str, Enum):
    SPEARHEAD = "SPEARHEAD"    # High-tempo push along highways toward bridges
    INFILTRATION = "INFILTRATION"  # Dispersed advance using forest cover


class HexCoord(BaseModel):
    q: int
    r: int

    def key(self) -> str:
        return f"{self.q},{self.r}"


class HexTile(BaseModel):
    q: int
    r: int
    terrain: TerrainType
    elevation: int = 1
    is_objective: bool = False
    label: Optional[str] = None


class Unit(BaseModel):
    id: str
    name: str
    faction: Faction
    unit_type: UnitType
    siddc: str = Field(description="NATO APP-6 SIDC code for milsymbol rendering")
    q: int
    r: int
    strength: float = Field(default=100.0, ge=0.0, le=100.0)
    supply: float = Field(default=100.0, ge=0.0, le=100.0)
    combat_power: float
    defense_modifier: float = 1.0
    sensor_range: int = 1
    attack_range: int = 1
    detected_by_enemy: bool = False
    detection_confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class UnitOrder(BaseModel):
    unit_id: str
    order_type: OrderType
    target_q: int
    target_r: int


class GameState(BaseModel):
    turn: int = 1
    max_turns: int = 8
    status: GameStatus = GameStatus.ACTIVE
    outcome_reason: Optional[str] = None
    red_doctrine: RedDoctrine = RedDoctrine.SPEARHEAD
    tiles: List[HexTile]
    units: List[Unit]
    combat_log: List[str] = Field(default_factory=list)


class TurnStepRequest(BaseModel):
    state: GameState
    blue_orders: Dict[str, UnitOrder]


class CoaSimulationRequest(BaseModel):
    state: GameState
    blue_orders: Dict[str, UnitOrder]
    iterations: int = Field(default=100, ge=10, le=1000)
    horizon_turns: int = Field(default=5, ge=1, le=8)


class CoaSimulationResponse(BaseModel):
    survival_probability: float
    expected_blue_strength: float
    expected_red_attrition: float
    hex_threat_heatmap: Dict[str, float] = Field(
        description="Map of 'q,r' -> probability [0..1] of Red control or breach"
    )
    tactical_recommendations: List[str]
