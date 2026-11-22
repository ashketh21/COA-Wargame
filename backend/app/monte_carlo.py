"""Monte Carlo Course of Action (COA) simulation and Utility AI advisor."""

from typing import Dict, List
from .engine import adjudicate_turn
from .hex_math import hex_distance
from .models import (
    CoaSimulationRequest,
    CoaSimulationResponse,
    Faction,
    GameState,
    GameStatus,
    OrderType,
    UnitOrder,
    UnitType,
)


def run_monte_carlo_coa(req: CoaSimulationRequest) -> CoaSimulationResponse:
    """Run N stochastic rollouts of the planned Blue COA over the specified turn horizon."""
    survivals = 0
    total_blue_strength = 0.0
    total_red_attrition = 0.0
    hex_breach_counts: Dict[str, int] = {f"{t.q},{t.r}": 0 for t in req.state.tiles}

    initial_red_units = [u for u in req.state.units if u.faction == Faction.RED]
    initial_red_strength = sum(u.strength for u in initial_red_units) or 1.0
    objectives = {(t.q, t.r) for t in req.state.tiles if t.is_objective}

    remaining_turns = max(1, req.state.max_turns - req.state.turn + 1)
    effective_horizon = min(req.horizon_turns, remaining_turns)

    for i in range(req.iterations):
        sim_state = req.state.model_copy(deep=True)
        for step in range(effective_horizon):
            if sim_state.status != GameStatus.ACTIVE:
                break
            # Use the player's plotted COA on turn 0, then baseline defensive doctrine for follow-on turns
            orders = req.blue_orders if step == 0 else recommend_blue_orders(sim_state)
            sim_state = adjudicate_turn(sim_state, orders, seed=(i * 100) + step)

        red_units = [u for u in sim_state.units if u.faction == Faction.RED and u.strength > 0]
        blue_ground = [
            u for u in sim_state.units
            if u.faction == Faction.BLUE and u.strength > 0 and u.unit_type != UnitType.ISR_UAS
        ]

        blue_avg = (
            sum(b.strength for b in blue_ground) / len(blue_ground)
            if blue_ground else 0.0
        )
        red_remaining = sum(r.strength for r in red_units)

        if sim_state.status != GameStatus.DEFEAT and blue_avg >= 35.0:
            survivals += 1

        total_blue_strength += blue_avg
        total_red_attrition += max(0.0, initial_red_strength - red_remaining) / max(1, len(initial_red_units))

        for r_unit in red_units:
            key = f"{r_unit.q},{r_unit.r}"
            hex_breach_counts[key] = hex_breach_counts.get(key, 0) + 1

    heatmap = {
        k: round(v / req.iterations, 2)
        for k, v in hex_breach_counts.items()
        if v > 0
    }

    recommendations: List[str] = []
    survival_prob = round(survivals / req.iterations, 2)

    # Generate explainable JISR / COA advisories
    high_risk_objectives = [
        f"({q},{r})" for (q, r) in sorted(objectives) if heatmap.get(f"{q},{r}", 0.0) >= 0.2
    ]
    if high_risk_objectives:
        recommendations.append(
            f"HIGH BREACH RISK at objective(s) {', '.join(high_risk_objectives)}. "
            "Reinforce Daugava crossings and prioritize indirect fires on approaching Red armor."
        )

    undetected_reds = [
        u for u in req.state.units
        if u.faction == Faction.RED and u.strength > 0 and not u.detected_by_enemy
    ]
    if undetected_reds:
        recommendations.append(
            f"JISR GAP: {len(undetected_reds)} adversary element(s) have low track confidence (<55%). "
            "Task 4 ISR Tactical UAS to RECON_SWEEP or reposition to unmask targets and remove blind-fire penalties."
        )

    arty_units = [
        u for u in req.state.units
        if u.faction == Faction.BLUE and u.strength > 0 and u.unit_type == UnitType.ARTILLERY
    ]
    if arty_units and all(
        req.blue_orders.get(
            a.id,
            UnitOrder(unit_id=a.id, order_type=OrderType.HOLD, target_q=a.q, target_r=a.r),
        ).order_type != OrderType.FIRE_SUPPORT
        for a in arty_units
    ):
        recommendations.append(
            "UNUTILIZED FIRES: 2 RCHA M777 Battery has no active FIRE_SUPPORT mission plotted. "
            "Assign indirect fire on detected Red units within 5 hexes to attrit BTGs before river contact."
        )

    if not recommendations:
        recommendations.append(
            "COA VALIDATED: Defensive posture, fires, and JISR coverage maintain strong Daugava corridor denial."
        )

    return CoaSimulationResponse(
        survival_probability=survival_prob,
        expected_blue_strength=round(total_blue_strength / req.iterations, 1),
        expected_red_attrition=round(total_red_attrition / req.iterations, 1),
        hex_threat_heatmap=heatmap,
        tactical_recommendations=recommendations,
    )


def recommend_blue_orders(state: GameState) -> Dict[str, UnitOrder]:
    """Utility-based AI advisor that generates a recommended Blue COA order set."""
    orders: Dict[str, UnitOrder] = {}
    red_detected = [
        u for u in state.units
        if u.faction == Faction.RED and u.strength > 0 and u.detected_by_enemy
    ]

    for unit in state.units:
        if unit.faction != Faction.BLUE or unit.strength <= 0:
            continue

        if unit.unit_type == UnitType.ISR_UAS:
            orders[unit.id] = UnitOrder(
                unit_id=unit.id,
                order_type=OrderType.RECON_SWEEP,
                target_q=unit.q,
                target_r=unit.r,
            )
        elif unit.unit_type == UnitType.ARTILLERY and red_detected and unit.supply >= 10.0:
            in_range = [
                r for r in red_detected
                if hex_distance(unit.q, unit.r, r.q, r.r) <= unit.attack_range
            ]
            if in_range:
                best_tgt = max(in_range, key=lambda r: r.combat_power)
                orders[unit.id] = UnitOrder(
                    unit_id=unit.id,
                    order_type=OrderType.FIRE_SUPPORT,
                    target_q=best_tgt.q,
                    target_r=best_tgt.r,
                )
            else:
                orders[unit.id] = UnitOrder(
                    unit_id=unit.id,
                    order_type=OrderType.HOLD,
                    target_q=unit.q,
                    target_r=unit.r,
                )
        else:
            orders[unit.id] = UnitOrder(
                unit_id=unit.id,
                order_type=OrderType.HOLD,
                target_q=unit.q,
                target_r=unit.r,
            )

    return orders
