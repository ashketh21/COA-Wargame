"""Core Action-Reaction-Counteraction wargame adjudication engine."""

import random
from typing import Dict, List, Optional, Set, Tuple
from .hex_math import hex_distance, hex_neighbors
from .models import (
    Faction,
    GameState,
    GameStatus,
    HexTile,
    OrderType,
    RedDoctrine,
    TerrainType,
    Unit,
    UnitOrder,
    UnitType,
)

TERRAIN_DEFENSE_BONUS: Dict[TerrainType, float] = {
    TerrainType.CLEAR: 1.0,
    TerrainType.HIGHWAY: 0.95,
    TerrainType.FOREST: 1.35,
    TerrainType.URBAN: 1.5,
    TerrainType.RIVER: 1.0,
    TerrainType.RIVER_BRIDGE: 1.4,
}


def _tile_lookup(state: GameState) -> Dict[str, HexTile]:
    return {f"{t.q},{t.r}": t for t in state.tiles}


def _is_ground_unit(unit: Unit) -> bool:
    return unit.unit_type != UnitType.ISR_UAS


def _ground_occupied_hexes(units: List[Unit], exclude_id: Optional[str] = None) -> Set[Tuple[int, int]]:
    return {
        (u.q, u.r)
        for u in units
        if u.strength > 0 and _is_ground_unit(u) and u.id != exclude_id
    }


def _can_ground_enter(
    q: int,
    r: int,
    tiles: Dict[str, HexTile],
    occupied_ground: Set[Tuple[int, int]],
) -> bool:
    tile = tiles.get(f"{q},{r}")
    if not tile or tile.terrain == TerrainType.RIVER:
        return False
    if (q, r) in occupied_ground:
        return False
    return True


def _update_jisr_fusion(
    state: GameState,
    all_orders: Dict[str, UnitOrder],
    tiles: Dict[str, HexTile],
) -> None:
    """Fuse Blue sensor coverage to compute track confidence for all Red units."""
    blue_sensors = [u for u in state.units if u.faction == Faction.BLUE and u.strength > 0]
    for red in state.units:
        if red.faction != Faction.RED or red.strength <= 0:
            continue
        best_conf = 0.15
        for blue in blue_sensors:
            order = all_orders.get(blue.id)
            is_sweeping = bool(order and order.order_type == OrderType.RECON_SWEEP)
            effective_range = blue.sensor_range + (1 if is_sweeping else 0)
            dist = hex_distance(blue.q, blue.r, red.q, red.r)
            if dist <= effective_range:
                tile = tiles.get(f"{red.q},{red.r}")
                cover_penalty = 0.2 if tile and tile.terrain == TerrainType.FOREST else 0.0
                sweep_bonus = 0.2 if is_sweeping else 0.0
                conf = max(0.2, min(1.0, 1.0 - (dist * 0.14) - cover_penalty + sweep_bonus))
                best_conf = max(best_conf, conf)

        red.detection_confidence = round(best_conf, 2)
        red.detected_by_enemy = best_conf >= 0.55


def _evaluate_mission_status(state: GameState, logs: List[str]) -> None:
    """Evaluate Victory/Defeat conditions after turn adjudication."""
    objectives = {(t.q, t.r) for t in state.tiles if t.is_objective}
    blue_alive = [u for u in state.units if u.faction == Faction.BLUE and u.strength > 0]
    blue_ground = [u for u in blue_alive if _is_ground_unit(u)]
    red_alive = [u for u in state.units if u.faction == Faction.RED and u.strength > 0]
    red_combat = [u for u in red_alive if u.unit_type in (UnitType.MECH_INF, UnitType.ARMOR)]

    breached_objs = [
        u for u in red_alive if _is_ground_unit(u) and (u.q, u.r) in objectives
    ]
    if breached_objs:
        state.status = GameStatus.DEFEAT
        first = breached_objs[0]
        state.outcome_reason = (
            f"Objective breached: {first.name} captured ({first.q},{first.r})."
        )
        logs.append(f"[MISSION DEFEAT] {state.outcome_reason}")
        return

    blue_avg = (
        sum(b.strength for b in blue_ground) / len(blue_ground)
        if blue_ground else 0.0
    )
    if not blue_ground or blue_avg < 35.0:
        state.status = GameStatus.DEFEAT
        state.outcome_reason = (
            f"Blue Task Force combat ineffective (avg ground strength {blue_avg:.1f}% < 35%)."
        )
        logs.append(f"[MISSION DEFEAT] {state.outcome_reason}")
        return

    if not red_combat:
        state.status = GameStatus.VICTORY
        state.outcome_reason = "All advancing Red maneuver battalions neutralized."
        logs.append(f"[MISSION VICTORY] {state.outcome_reason}")
        return

    if state.turn > state.max_turns:
        state.status = GameStatus.VICTORY
        state.outcome_reason = (
            f"Daugava River corridor held for all {state.max_turns} turns "
            f"(avg Blue strength {blue_avg:.1f}%)."
        )
        logs.append(f"[MISSION VICTORY] {state.outcome_reason}")


def generate_red_orders(state: GameState, rng: random.Random) -> Dict[str, UnitOrder]:
    """Generate Red AI reaction orders according to active adversarial doctrine."""
    orders: Dict[str, UnitOrder] = {}
    tiles = _tile_lookup(state)
    blue_ground = [
        u for u in state.units
        if u.faction == Faction.BLUE and u.strength > 0 and _is_ground_unit(u)
    ]
    objectives = [t for t in state.tiles if t.is_objective]
    bridges = [t for t in objectives if t.terrain == TerrainType.RIVER_BRIDGE]
    occupied_ground = _ground_occupied_hexes(state.units)

    for red in state.units:
        if red.faction != Faction.RED or red.strength <= 0:
            continue

        if red.unit_type == UnitType.ARTILLERY:
            # Target highest-strength Blue ground unit within range
            in_range = [
                b for b in blue_ground
                if hex_distance(red.q, red.r, b.q, b.r) <= red.attack_range
            ]
            if in_range and red.supply >= 10.0:
                target = max(in_range, key=lambda b: b.strength)
                orders[red.id] = UnitOrder(
                    unit_id=red.id,
                    order_type=OrderType.FIRE_SUPPORT,
                    target_q=target.q,
                    target_r=target.r,
                )
                continue

        # If already adjacent to a Blue ground unit at a bridge, stay and engage unless a bridge is open
        adjacent_blue = [
            b for b in blue_ground
            if hex_distance(red.q, red.r, b.q, b.r) <= 1
        ]
        # East of the river (q > 3), target the river crossings so Red doesn't dead-end on impassable water
        nav_targets = bridges if (red.q > 3 and bridges) else objectives

        # Check if an objective is directly reachable and unoccupied
        open_obj = next(
            (
                nb for nb in hex_neighbors(red.q, red.r)
                if any(nb.q == o.q and nb.r == o.r for o in objectives)
                and _can_ground_enter(nb.q, nb.r, tiles, occupied_ground)
            ),
            None,
        )
        if open_obj:
            orders[red.id] = UnitOrder(
                unit_id=red.id,
                order_type=OrderType.MOVE,
                target_q=open_obj.q,
                target_r=open_obj.r,
            )
            occupied_ground.add((open_obj.q, open_obj.r))
            continue

        if adjacent_blue and red.unit_type != UnitType.ARTILLERY:
            orders[red.id] = UnitOrder(
                unit_id=red.id,
                order_type=OrderType.HOLD,
                target_q=red.q,
                target_r=red.r,
            )
            continue

        current_dist = min(hex_distance(red.q, red.r, obj.q, obj.r) for obj in nav_targets)
        best_neighbor: Optional[Tuple[int, int]] = None
        best_score = current_dist + 0.1  # Only move if it makes progress or matches doctrine

        for nb in hex_neighbors(red.q, red.r):
            if not _can_ground_enter(nb.q, nb.r, tiles, occupied_ground):
                continue
            min_obj_dist = min(
                hex_distance(nb.q, nb.r, obj.q, obj.r) for obj in nav_targets
            )
            tile = tiles.get(f"{nb.q},{nb.r}")
            terrain_pref = 0.0
            if state.red_doctrine == RedDoctrine.SPEARHEAD and tile and tile.terrain == TerrainType.HIGHWAY:
                terrain_pref = -0.45
            elif state.red_doctrine == RedDoctrine.INFILTRATION and tile and tile.terrain == TerrainType.FOREST:
                terrain_pref = -0.45

            score = min_obj_dist + terrain_pref + rng.uniform(-0.12, 0.12)
            if score < best_score:
                best_score = score
                best_neighbor = (nb.q, nb.r)

        if best_neighbor:
            orders[red.id] = UnitOrder(
                unit_id=red.id,
                order_type=OrderType.MOVE,
                target_q=best_neighbor[0],
                target_r=best_neighbor[1],
            )
            occupied_ground.add(best_neighbor)
        else:
            orders[red.id] = UnitOrder(
                unit_id=red.id,
                order_type=OrderType.HOLD,
                target_q=red.q,
                target_r=red.r,
            )

    return orders


def adjudicate_turn(
    state: GameState,
    blue_orders: Dict[str, UnitOrder],
    seed: Optional[int] = None,
) -> GameState:
    """Execute one full Action-Reaction-Counteraction turn cycle."""
    if state.status != GameStatus.ACTIVE:
        return state.model_copy(deep=True)

    rng = random.Random(seed)
    next_state = state.model_copy(deep=True)
    tiles = _tile_lookup(next_state)
    logs = [f"--- TURN {next_state.turn} ADJUDICATION ---"]

    red_orders = generate_red_orders(next_state, rng)
    all_orders = {**blue_orders, **red_orders}

    # 0. Posture Setup
    for unit in next_state.units:
        if unit.strength <= 0:
            continue
        order = all_orders.get(unit.id)
        unit.defense_modifier = 1.0
        if not order or order.order_type == OrderType.HOLD:
            unit.defense_modifier = 1.25
        elif order.order_type == OrderType.RECON_SWEEP:
            unit.defense_modifier = 0.9

    # 1. Air / ISR Maneuver & JISR Sensor Fusion Phase
    for unit in next_state.units:
        if unit.strength <= 0 or unit.unit_type != UnitType.ISR_UAS:
            continue
        order = all_orders.get(unit.id)
        if order and order.order_type == OrderType.MOVE:
            dist = hex_distance(unit.q, unit.r, order.target_q, order.target_r)
            if dist <= 2 and f"{order.target_q},{order.target_r}" in tiles:
                if unit.supply >= 4.0:
                    unit.q = order.target_q
                    unit.r = order.target_r
                    unit.supply = max(0.0, unit.supply - 4.0)
                    logs.append(f"[ISR] {unit.name} repositioned to ({unit.q},{unit.r}).")
                else:
                    logs.append(f"[ISR] {unit.name} low fuel/supply — holding station.")
        elif order and order.order_type == OrderType.RECON_SWEEP:
            unit.supply = max(0.0, unit.supply - 3.0)
            logs.append(f"[ISR] {unit.name} conducting wide-area RECON_SWEEP from ({unit.q},{unit.r}).")

    _update_jisr_fusion(next_state, all_orders, tiles)

    # 2. Preparatory / Indirect Fire Support Phase (resolves before ground movement so plotted fires hit!)
    for unit in next_state.units:
        if unit.strength <= 0 or unit.unit_type != UnitType.ARTILLERY:
            continue
        order = all_orders.get(unit.id)
        if not order or order.order_type != OrderType.FIRE_SUPPORT:
            continue

        dist = hex_distance(unit.q, unit.r, order.target_q, order.target_r)
        if dist > unit.attack_range:
            logs.append(
                f"[FIRE SUPPORT] {unit.name} target ({order.target_q},{order.target_r}) out of range ({dist} > {unit.attack_range})."
            )
            continue
        if unit.supply < 10.0:
            logs.append(f"[FIRE SUPPORT] {unit.name} insufficient ammunition ({unit.supply:.0f}%).")
            continue

        targets = [
            u for u in next_state.units
            if u.faction != unit.faction
            and u.strength > 0
            and _is_ground_unit(u)
            and u.q == order.target_q
            and u.r == order.target_r
        ]
        unit.supply = max(0.0, unit.supply - 10.0)

        if not targets:
            logs.append(
                f"[FIRE SUPPORT] {unit.name} shelled empty hex ({order.target_q},{order.target_r})."
            )
            continue

        for tgt in targets:
            tile = tiles.get(f"{tgt.q},{tgt.r}")
            terrain_mod = TERRAIN_DEFENSE_BONUS.get(tile.terrain, 1.0) if tile else 1.0

            # Detection accuracy modifier (for Blue targeting Red)
            if unit.faction == Faction.BLUE and not tgt.detected_by_enemy:
                intel_mod = 0.5
                intel_note = " [blind fire -50%]"
            else:
                intel_mod = 1.0
                intel_note = ""

            # JISR spotting multiplier if a friendly UAS is within 3 hexes
            spotting_uas = [
                u for u in next_state.units
                if u.faction == unit.faction
                and u.unit_type == UnitType.ISR_UAS
                and u.strength > 0
                and hex_distance(u.q, u.r, tgt.q, tgt.r) <= 3
            ]
            isr_bonus = 1.0
            if spotting_uas:
                any_sweeping = any(
                    all_orders.get(u.id) and all_orders[u.id].order_type == OrderType.RECON_SWEEP
                    for u in spotting_uas
                )
                isr_bonus = 1.45 if any_sweeping else 1.3
                intel_note += " [UAS spotted]"

            dmg = (unit.combat_power * 0.35 * intel_mod * isr_bonus * rng.uniform(0.85, 1.2)) / (
                terrain_mod * tgt.defense_modifier
            )
            tgt.strength = round(max(0.0, tgt.strength - dmg), 1)
            logs.append(
                f"[FIRE SUPPORT] {unit.name} struck {tgt.name} at ({tgt.q},{tgt.r}) for -{dmg:.1f}%{intel_note}."
            )

    # 3. Ground Maneuver Phase
    for unit in next_state.units:
        if unit.strength <= 0 or not _is_ground_unit(unit):
            continue
        order = all_orders.get(unit.id)
        if not order or order.order_type != OrderType.MOVE:
            continue

        dist = hex_distance(unit.q, unit.r, order.target_q, order.target_r)
        occupied = _ground_occupied_hexes(next_state.units, exclude_id=unit.id)
        if dist > 1:
            logs.append(f"[{unit.faction}] {unit.name} move to ({order.target_q},{order.target_r}) exceeded 1-hex limit.")
        elif unit.supply < 6.0:
            logs.append(f"[{unit.faction}] {unit.name} insufficient fuel/supply to maneuver.")
        elif not _can_ground_enter(order.target_q, order.target_r, tiles, occupied):
            logs.append(f"[{unit.faction}] {unit.name} blocked from entering ({order.target_q},{order.target_r}).")
        else:
            unit.q = order.target_q
            unit.r = order.target_r
            unit.supply = max(0.0, unit.supply - 6.0)
            logs.append(f"[{unit.faction}] {unit.name} maneuvered to ({unit.q},{unit.r}).")

    # 4. Direct Contact Combat Phase (ground combat units only — UAS flies overhead!)
    for unit in next_state.units:
        if unit.strength <= 0 or unit.unit_type in (UnitType.ARTILLERY, UnitType.ISR_UAS):
            continue

        adjacent_enemies = [
            u for u in next_state.units
            if u.faction != unit.faction
            and u.strength > 0
            and _is_ground_unit(u)
            and hex_distance(unit.q, unit.r, u.q, u.r) <= 1
        ]
        if adjacent_enemies:
            target = min(adjacent_enemies, key=lambda e: e.strength)
            tile = tiles.get(f"{target.q},{target.r}")
            terrain_mod = TERRAIN_DEFENSE_BONUS.get(tile.terrain, 1.0) if tile else 1.0
            effective_power = unit.combat_power * (unit.strength / 100.0)
            dmg = (effective_power * 0.28 * rng.uniform(0.85, 1.2)) / (
                terrain_mod * target.defense_modifier
            )
            target.strength = round(max(0.0, target.strength - dmg), 1)
            unit.supply = max(0.0, unit.supply - 5.0)
            logs.append(
                f"[DIRECT CONTACT] {unit.name} engaged {target.name} at ({target.q},{target.r}) -> -{dmg:.1f}% str."
            )

    # 4b. SHORAD / EW attrition on UAS if loitering directly over/adjacent to enemy ground units
    for uas in next_state.units:
        if uas.strength <= 0 or uas.unit_type != UnitType.ISR_UAS:
            continue
        close_enemies = [
            e for e in next_state.units
            if e.faction != uas.faction
            and e.strength > 0
            and _is_ground_unit(e)
            and hex_distance(uas.q, uas.r, e.q, e.r) <= 1
        ]
        if close_enemies:
            ew_dmg = round(rng.uniform(4.0, 9.0), 1)
            uas.strength = round(max(0.0, uas.strength - ew_dmg), 1)
            logs.append(
                f"[EW/SHORAD] {uas.name} took -{ew_dmg:.1f}% attrition near enemy air-defense envelope at ({uas.q},{uas.r})."
            )

    # 5. Post-Maneuver JISR Refresh & Mission Evaluation
    _update_jisr_fusion(next_state, all_orders, tiles)
    next_state.turn += 1
    _evaluate_mission_status(next_state, logs)
    next_state.combat_log = (next_state.combat_log + logs)[-40:]
    return next_state
