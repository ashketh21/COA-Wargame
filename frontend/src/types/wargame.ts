export type Faction = 'BLUE' | 'RED';
export type UnitType = 'MECH_INF' | 'ARMOR' | 'ISR_UAS' | 'ARTILLERY';
export type TerrainType = 'CLEAR' | 'FOREST' | 'URBAN' | 'RIVER' | 'RIVER_BRIDGE' | 'HIGHWAY';
export type OrderType = 'HOLD' | 'MOVE' | 'RECON_SWEEP' | 'FIRE_SUPPORT';
export type RedDoctrine = 'SPEARHEAD' | 'INFILTRATION';
export type GameStatus = 'ACTIVE' | 'VICTORY' | 'DEFEAT';

export interface HexTile {
  q: number;
  r: number;
  terrain: TerrainType;
  elevation: number;
  is_objective: boolean;
  label?: string | null;
}

export interface Unit {
  id: string;
  name: string;
  faction: Faction;
  unit_type: UnitType;
  siddc: string;
  q: number;
  r: number;
  strength: number;
  supply: number;
  combat_power: number;
  defense_modifier: number;
  sensor_range: number;
  attack_range: number;
  detected_by_enemy: boolean;
  detection_confidence: number;
}

export interface UnitOrder {
  unit_id: string;
  order_type: OrderType;
  target_q: number;
  target_r: number;
}

export interface GameState {
  turn: number;
  max_turns: number;
  status: GameStatus;
  outcome_reason?: string | null;
  red_doctrine: RedDoctrine;
  tiles: HexTile[];
  units: Unit[];
  combat_log: string[];
}

export interface CoaSimulationResponse {
  survival_probability: number;
  expected_blue_strength: number;
  expected_red_attrition: number;
  hex_threat_heatmap: Record<string, number>;
  tactical_recommendations: string[];
}
