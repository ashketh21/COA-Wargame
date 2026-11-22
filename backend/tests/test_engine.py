"""Unit tests for the CAF COA Wargamer adjudication and Monte Carlo engine."""

from app.engine import adjudicate_turn
from app.models import (
    CoaSimulationRequest,
    Faction,
    GameStatus,
    OrderType,
    TerrainType,
    UnitOrder,
    UnitType,
)
from app.monte_carlo import recommend_blue_orders, run_monte_carlo_coa
from app.scenario import create_initial_scenario


def test_initial_scenario_has_river_barrier():
    state = create_initial_scenario()
    assert state.turn == 1
    assert state.status == GameStatus.ACTIVE
    assert len(state.units) == 8

    river_tiles = [t for t in state.tiles if t.terrain == TerrainType.RIVER]
    bridge_tiles = [t for t in state.tiles if t.terrain == TerrainType.RIVER_BRIDGE]
    assert len(river_tiles) == 6  # Column q=3 except r=2 and r=5
    assert len(bridge_tiles) == 2


def test_ground_units_cannot_cross_river_but_uas_can():
    state = create_initial_scenario()
    # Attempt to move 1 RCR from Jekabpils Bridge (3,1) into River (3,2) -> should be blocked
    # Move UAS from (4,3) across River to (3,3) -> should succeed
    orders = {
        "blue-lav-1": UnitOrder(
            unit_id="blue-lav-1",
            order_type=OrderType.MOVE,
            target_q=3,
            target_r=2,
        ),
        "blue-uas-1": UnitOrder(
            unit_id="blue-uas-1",
            order_type=OrderType.MOVE,
            target_q=3,
            target_r=3,
        ),
    }
    next_state = adjudicate_turn(state, orders, seed=42)
    lav = next(u for u in next_state.units if u.id == "blue-lav-1")
    uas = next(u for u in next_state.units if u.id == "blue-uas-1")
    assert (lav.q, lav.r) == (3, 1)
    assert (uas.q, uas.r) == (3, 3)


def test_fire_support_hits_before_red_moves():
    state = create_initial_scenario()
    red_btg = next(u for u in state.units if u.id == "red-btg-1")
    initial_str = red_btg.strength

    # M777 at (2,3) has range 5 -> can hit red-btg-1 at (6,1) (dist=4)
    orders = {
        "blue-arty-1": UnitOrder(
            unit_id="blue-arty-1",
            order_type=OrderType.FIRE_SUPPORT,
            target_q=red_btg.q,
            target_r=red_btg.r,
        ),
    }
    next_state = adjudicate_turn(state, orders, seed=7)
    red_btg_after = next(u for u in next_state.units if u.id == "red-btg-1")
    assert red_btg_after.strength < initial_str


def test_mission_ends_with_victory_or_defeat():
    state = create_initial_scenario()
    for step in range(10):
        orders = recommend_blue_orders(state)
        state = adjudicate_turn(state, orders, seed=100 + step)
        if state.status != GameStatus.ACTIVE:
            break

    assert state.status in (GameStatus.VICTORY, GameStatus.DEFEAT)
    assert state.outcome_reason is not None
    # Calling adjudicate_turn again after game over should be a no-op
    turn_at_end = state.turn
    after = adjudicate_turn(state, {}, seed=999)
    assert after.turn == turn_at_end


def test_monte_carlo_coa_simulation():
    state = create_initial_scenario()
    orders = recommend_blue_orders(state)
    req = CoaSimulationRequest(
        state=state,
        blue_orders=orders,
        iterations=25,
        horizon_turns=5,
    )
    res = run_monte_carlo_coa(req)
    assert 0.0 <= res.survival_probability <= 1.0
    assert len(res.tactical_recommendations) >= 1
