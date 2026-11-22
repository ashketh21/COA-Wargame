"""Default Operation REASSURANCE (Daugava River / Latgale Corridor) tactical scenario generator."""

from typing import List
from .models import Faction, GameState, GameStatus, HexTile, RedDoctrine, TerrainType, Unit, UnitType


def create_initial_scenario() -> GameState:
    tiles: List[HexTile] = []
    # 10x8 operational sector spanning Selonia -> Daugava River (q=3) -> Latgale (Jekabpils to Daugavpils)
    for q in range(10):
        for r in range(8):
            terrain = TerrainType.CLEAR
            is_obj = False
            label = None

            if q == 3 and r == 1:
                terrain = TerrainType.RIVER_BRIDGE
                is_obj = True
                label = "Jekabpils Bridge (Daugava North)"
            elif q == 3 and r == 6:
                terrain = TerrainType.RIVER_BRIDGE
                is_obj = True
                label = "Daugavpils Unity Bridge (Daugava South)"
            elif q == 3:
                terrain = TerrainType.RIVER
                label = "Daugava River (Impassable)"
            elif q == 2 and r == 1:
                terrain = TerrainType.URBAN
                is_obj = True
                label = "FOB Selpils (West Bank Hub)"
            elif q == 8 and r == 1:
                terrain = TerrainType.URBAN
                label = "Rezekne Approach"
            elif q == 5 and r == 3:
                terrain = TerrainType.URBAN
                label = "Preili"
            elif q == 6 and r == 6:
                terrain = TerrainType.URBAN
                label = "Kraslava"
            elif r == 1 or r == 6:
                terrain = TerrainType.HIGHWAY
                label = "A12 Corridor" if r == 1 else "A6 Corridor"
            elif (q + r) % 3 == 0 and q > 3:
                terrain = TerrainType.FOREST

            tiles.append(
                HexTile(
                    q=q,
                    r=r,
                    terrain=terrain,
                    is_objective=is_obj,
                    label=label,
                )
            )

    units: List[Unit] = [
        # Blue Force: CAF-led NATO Multinational Brigade - Latvia (Op REASSURANCE)
        Unit(
            id="blue-lav-1",
            name="1 RCR Mechanized Coy (LAV 6.0)",
            faction=Faction.BLUE,
            unit_type=UnitType.MECH_INF,
            siddc="SFGPUCIZ---E---",
            q=3,
            r=1,
            combat_power=28.0,
            sensor_range=2,
            attack_range=1,
            detected_by_enemy=True,
        ),
        Unit(
            id="blue-leo-1",
            name="LdSH(RC) Leopard 2A4M Sqn",
            faction=Faction.BLUE,
            unit_type=UnitType.ARMOR,
            siddc="SFGPUCA----E---",
            q=3,
            r=6,
            combat_power=38.0,
            sensor_range=2,
            attack_range=1,
            detected_by_enemy=True,
        ),
        Unit(
            id="blue-uas-1",
            name="4 ISR Tactical UAS Det (Blackjack)",
            faction=Faction.BLUE,
            unit_type=UnitType.ISR_UAS,
            siddc="SFGPUCVU---D---",
            q=4,
            r=3,
            combat_power=0.0,
            sensor_range=4,
            attack_range=0,
            detected_by_enemy=False,
        ),
        Unit(
            id="blue-arty-1",
            name="2 RCHA M777 Battery",
            faction=Faction.BLUE,
            unit_type=UnitType.ARTILLERY,
            siddc="SFGPUCFH---E---",
            q=2,
            r=3,
            combat_power=32.0,
            sensor_range=1,
            attack_range=5,
            detected_by_enemy=False,
        ),
        # Red Force: Advancing Mechanized BTGs from Latgale
        Unit(
            id="red-btg-1",
            name="1st Guards Motor Rifle BTG",
            faction=Faction.RED,
            unit_type=UnitType.MECH_INF,
            siddc="SHGPUCIZ---F---",
            q=6,
            r=1,
            combat_power=30.0,
            sensor_range=2,
            attack_range=1,
            detected_by_enemy=True,
            detection_confidence=0.80,
        ),
        Unit(
            id="red-tank-1",
            name="4th Tank Regiment Spearhead",
            faction=Faction.RED,
            unit_type=UnitType.ARMOR,
            siddc="SHGPUCA----F---",
            q=6,
            r=6,
            combat_power=42.0,
            sensor_range=2,
            attack_range=1,
            detected_by_enemy=False,
            detection_confidence=0.35,
        ),
        Unit(
            id="red-recon-1",
            name="Spetsnaz Recon Element",
            faction=Faction.RED,
            unit_type=UnitType.MECH_INF,
            siddc="SHGPUCR----E---",
            q=5,
            r=4,
            combat_power=20.0,
            sensor_range=3,
            attack_range=1,
            detected_by_enemy=False,
            detection_confidence=0.45,
        ),
        Unit(
            id="red-arty-1",
            name="2S19 Msta-S Artillery Div",
            faction=Faction.RED,
            unit_type=UnitType.ARTILLERY,
            siddc="SHGPUCFH---F---",
            q=7,
            r=3,
            combat_power=26.0,
            sensor_range=1,
            attack_range=5,
            detected_by_enemy=False,
            detection_confidence=0.15,
        ),
    ]

    return GameState(
        turn=1,
        max_turns=8,
        status=GameStatus.ACTIVE,
        outcome_reason=None,
        red_doctrine=RedDoctrine.SPEARHEAD,
        tiles=tiles,
        units=units,
        combat_log=[
            "TURN 1 INITIALIZED: Operation REASSURANCE (MNB-LVA) — Hold Jekabpils & Daugavpils Daugava crossings for 8 turns.",
            "JISR Advisories: Confirmed contact on A12 Corridor (6,1); faint SIGINT tracks near Kraslava (6,6) and central Latgale.",
        ],
    )
