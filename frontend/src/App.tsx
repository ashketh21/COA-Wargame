import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TacticalMap } from './components/TacticalMap';
import { HowToPlayModal } from './components/HowToPlayModal';
import {
  CoaSimulationResponse,
  GameState,
  OrderType,
  RedDoctrine,
  Unit,
  UnitOrder,
  UnitType,
} from './types/wargame';

function hexDistance(aq: number, ar: number, bq: number, br: number): number {
  return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
}

function getAllowedOrders(unitType: UnitType): OrderType[] {
  switch (unitType) {
    case 'ISR_UAS':
      return ['HOLD', 'MOVE', 'RECON_SWEEP'];
    case 'ARTILLERY':
      return ['HOLD', 'MOVE', 'FIRE_SUPPORT'];
    default:
      return ['HOLD', 'MOVE'];
  }
}

function getDefaultOrderMode(unitType: UnitType): OrderType {
  switch (unitType) {
    case 'ARTILLERY':
      return 'FIRE_SUPPORT';
    case 'ISR_UAS':
      return 'RECON_SWEEP';
    default:
      return 'MOVE';
  }
}

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeOrderType, setActiveOrderType] = useState<OrderType>('MOVE');
  const [blueOrders, setBlueOrders] = useState<Record<string, UnitOrder>>({});
  const [coaReport, setCoaReport] = useState<CoaSimulationResponse | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const fetchScenario = async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/scenario');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GameState = await res.json();
      setGameState(data);
      const firstBlue = data.units.find((u) => u.faction === 'BLUE' && u.strength > 0) ?? null;
      setSelectedUnitId(firstBlue?.id ?? null);
      setActiveOrderType(firstBlue ? getDefaultOrderMode(firstBlue.unit_type) : 'MOVE');
      setBlueOrders({});
      setCoaReport(null);
      setStatusNotice(null);
    } catch {
      setErrorMessage('Could not reach the simulation backend. Please retry.');
    }
  };

  useEffect(() => {
    fetchScenario();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.combat_log]);

  const selectedUnit: Unit | null = useMemo(() => {
    if (!gameState || !selectedUnitId) return null;
    return gameState.units.find((u) => u.id === selectedUnitId && u.strength > 0) ?? null;
  }, [gameState, selectedUnitId]);

  const validTargetKeys: Set<string> = useMemo(() => {
    const keys = new Set<string>();
    if (!gameState || !selectedUnit || gameState.status !== 'ACTIVE') return keys;
    if (activeOrderType !== 'MOVE' && activeOrderType !== 'FIRE_SUPPORT') return keys;

    const occupiedGround = new Set(
      gameState.units
        .filter((u) => u.strength > 0 && u.unit_type !== 'ISR_UAS' && u.id !== selectedUnit.id)
        .map((u) => `${u.q},${u.r}`)
    );

    for (const tile of gameState.tiles) {
      const dist = hexDistance(selectedUnit.q, selectedUnit.r, tile.q, tile.r);
      const key = `${tile.q},${tile.r}`;

      if (activeOrderType === 'MOVE') {
        const maxMove = selectedUnit.unit_type === 'ISR_UAS' ? 2 : 1;
        if (dist < 1 || dist > maxMove) continue;
        if (selectedUnit.unit_type !== 'ISR_UAS') {
          if (tile.terrain === 'RIVER' || occupiedGround.has(key)) continue;
        }
        keys.add(key);
      } else if (activeOrderType === 'FIRE_SUPPORT' && selectedUnit.unit_type === 'ARTILLERY') {
        if (dist >= 1 && dist <= selectedUnit.attack_range) {
          keys.add(key);
        }
      }
    }
    return keys;
  }, [gameState, selectedUnit, activeOrderType]);

  if (!gameState) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300 font-mono">
        <div>
          {errorMessage ?? 'Initializing CAF JISR & Tactical Wargaming Environment...'}
        </div>
        {errorMessage && (
          <button
            onClick={fetchScenario}
            className="rounded border border-emerald-500/60 bg-emerald-950/50 px-4 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/60"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  const isGameOver = gameState.status !== 'ACTIVE';

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
    setStatusNotice(null);
    const unit = gameState.units.find((u) => u.id === unitId);
    if (unit) {
      const allowed = getAllowedOrders(unit.unit_type);
      if (!allowed.includes(activeOrderType)) {
        setActiveOrderType(getDefaultOrderMode(unit.unit_type));
      }
    }
  };

  const handleSelectOrderMode = (mode: OrderType) => {
    setActiveOrderType(mode);
    setStatusNotice(null);
    if (!selectedUnit || isGameOver) return;
    if (mode === 'HOLD' || mode === 'RECON_SWEEP') {
      setBlueOrders((prev) => ({
        ...prev,
        [selectedUnit.id]: {
          unit_id: selectedUnit.id,
          order_type: mode,
          target_q: selectedUnit.q,
          target_r: selectedUnit.r,
        },
      }));
    }
  };

  const handleSelectHex = (q: number, r: number) => {
    if (!selectedUnit || isGameOver) return;
    if (activeOrderType === 'HOLD' || activeOrderType === 'RECON_SWEEP') {
      handleSelectOrderMode(activeOrderType);
      return;
    }

    const key = `${q},${r}`;
    if (!validTargetKeys.has(key)) {
      const reason =
        activeOrderType === 'MOVE'
          ? selectedUnit.unit_type === 'ISR_UAS'
            ? 'Invalid move: UAS can move up to 2 hexes per turn.'
            : 'Invalid move: Ground units move 1 hex and cannot enter River or occupied hexes.'
          : `Out of range: ${selectedUnit.name} max range is ${selectedUnit.attack_range} hexes.`;
      setStatusNotice(reason);
      return;
    }

    setStatusNotice(null);
    setBlueOrders((prev) => ({
      ...prev,
      [selectedUnit.id]: {
        unit_id: selectedUnit.id,
        order_type: activeOrderType,
        target_q: q,
        target_r: r,
      },
    }));
  };

  const handleSimulateCoa = async () => {
    if (isGameOver) return;
    setLoading(true);
    try {
      const horizon = Math.min(5, Math.max(1, gameState.max_turns - gameState.turn + 1));
      const res = await fetch('/api/simulate-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: gameState,
          blue_orders: blueOrders,
          iterations: 100,
          horizon_turns: horizon,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CoaSimulationResponse = await res.json();
      setCoaReport(data);
    } catch {
      setStatusNotice('Monte Carlo simulation failed — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendOrders = async () => {
    if (isGameOver) return;
    try {
      const res = await fetch('/api/recommend-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameState),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const recommended: Record<string, UnitOrder> = await res.json();
      setBlueOrders(recommended);
      setStatusNotice('Applied Utility-AI recommended Blue COA orders.');
    } catch {
      setStatusNotice('Could not fetch AI order recommendations — please try again.');
    }
  };

  const handleCommitTurn = async () => {
    if (isGameOver) return;
    setLoading(true);
    try {
      const res = await fetch('/api/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: gameState,
          blue_orders: blueOrders,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const nextState: GameState = await res.json();
      setGameState(nextState);
      setBlueOrders({});
      setCoaReport(null);
      setStatusNotice(null);
      const stillAlive = nextState.units.some(
        (u) => u.id === selectedUnitId && u.strength > 0
      );
      if (!stillAlive) {
        const nextBlue = nextState.units.find((u) => u.faction === 'BLUE' && u.strength > 0) ?? null;
        setSelectedUnitId(nextBlue?.id ?? null);
        if (nextBlue) {
          setActiveOrderType(getDefaultOrderMode(nextBlue.unit_type));
        }
      }
    } catch {
      setStatusNotice('Turn adjudication request failed — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const allowedOrders = selectedUnit ? getAllowedOrders(selectedUnit.unit_type) : [];

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      {/* Top Command Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            CAF OPP / JISR Decision Support Prototype
          </span>
          <h1 className="text-lg font-bold tracking-tight">
            Operation REASSURANCE — Tactical COA Wargame
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-mono">
          <div className="rounded bg-slate-800 px-3 py-1">
            TURN {Math.min(gameState.turn, gameState.max_turns)} / {gameState.max_turns}
          </div>
          <select
            value={gameState.red_doctrine}
            disabled={isGameOver}
            onChange={(e) =>
              setGameState({ ...gameState, red_doctrine: e.target.value as RedDoctrine })
            }
            className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs disabled:opacity-50"
          >
            <option value="SPEARHEAD">Red Doctrine: Highway Spearhead</option>
            <option value="INFILTRATION">Red Doctrine: Forest Infiltration</option>
          </select>
          <button
            onClick={() => setShowHowToPlay(true)}
            className="rounded border border-emerald-500/50 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/50"
          >
            ? How to Play
          </button>
          <button
            onClick={fetchScenario}
            className="rounded border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
          >
            Reset Scenario
          </button>
        </div>
      </header>

      {/* Mission Outcome Banner */}
      {isGameOver && (
        <div
          className={`flex items-center justify-between border-b px-5 py-3 font-mono text-sm ${
            gameState.status === 'VICTORY'
              ? 'border-emerald-500/50 bg-emerald-950/70 text-emerald-200'
              : 'border-rose-500/50 bg-rose-950/70 text-rose-200'
          }`}
        >
          <div>
            <span className="font-bold uppercase tracking-wider mr-3">
              {gameState.status === 'VICTORY' ? 'MISSION VICTORY' : 'MISSION DEFEAT'}
            </span>
            <span className="text-xs">{gameState.outcome_reason}</span>
          </div>
          <button
            onClick={fetchScenario}
            className="rounded bg-slate-100 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-white"
          >
            Play Again
          </button>
        </div>
      )}

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      {/* Main Content Area */}
      <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
        {/* Left Sidebar: ORBAT & Unit Order Plotting */}
        <aside className="col-span-3 flex flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Blue Task Force ORBAT (Click to Task)
          </h2>
          <div className="space-y-2">
            {gameState.units
              .filter((u) => u.faction === 'BLUE')
              .map((u) => {
                const order = blueOrders[u.id];
                const isDestroyed = u.strength <= 0;
                return (
                  <button
                    key={u.id}
                    disabled={isDestroyed}
                    onClick={() => handleSelectUnit(u.id)}
                    className={`w-full rounded border p-2.5 text-left transition ${
                      isDestroyed
                        ? 'border-slate-800 bg-slate-950/50 opacity-45 cursor-not-allowed'
                        : selectedUnitId === u.id
                        ? 'border-emerald-500 bg-emerald-950/30'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{u.name}</span>
                      <span
                        className={`font-mono ${
                          u.strength <= 0
                            ? 'text-rose-500'
                            : u.strength < 50
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {isDestroyed ? 'DESTROYED' : `${u.strength}%`}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] font-mono text-slate-400">
                      <span>
                        Hex ({u.q},{u.r}) • Supply {u.supply}%
                      </span>
                      <span className="text-sky-400">
                        {isDestroyed
                          ? '—'
                          : order
                          ? `${order.order_type}${
                              order.order_type === 'MOVE' || order.order_type === 'FIRE_SUPPORT'
                                ? ` -> (${order.target_q},${order.target_r})`
                                : ''
                            }`
                          : 'HOLD'}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>

          {selectedUnit && !isGameOver && (
            <div className="mt-2 rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs font-mono text-slate-400 mb-2">
                Order Mode for <span className="text-slate-200">{selectedUnit.name}</span>:
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                {allowedOrders.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleSelectOrderMode(mode)}
                    className={`rounded py-1.5 px-2 border ${
                      activeOrderType === mode
                        ? mode === 'FIRE_SUPPORT'
                          ? 'border-rose-400 bg-rose-950 text-rose-300'
                          : 'border-sky-400 bg-sky-950 text-sky-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] font-mono text-slate-400">
                {activeOrderType === 'MOVE' &&
                  (selectedUnit.unit_type === 'ISR_UAS'
                    ? 'Click any green-highlighted hex (up to 2 hexes, flies over river).'
                    : 'Click an adjacent green-highlighted hex (cannot enter River).')}
                {activeOrderType === 'FIRE_SUPPORT' &&
                  `Click any rose-highlighted hex within ${selectedUnit.attack_range} hexes (fires before Red moves).`}
                {activeOrderType === 'HOLD' && 'Unit set to HOLD (+25% defense bonus).'}
                {activeOrderType === 'RECON_SWEEP' &&
                  'UAS set to RECON_SWEEP (+1 sensor range, +20% confidence, +45% artillery spotting).'}
              </div>
            </div>
          )}

          {statusNotice && (
            <div className="rounded border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-[11px] font-mono text-amber-300">
              {statusNotice}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={handleRecommendOrders}
              disabled={isGameOver || loading}
              className="w-full rounded border border-amber-500/50 bg-amber-950/40 py-2 text-xs font-mono font-semibold text-amber-300 hover:bg-amber-900/50 disabled:opacity-40"
            >
              AI Suggest Blue COA Orders
            </button>
            <button
              onClick={handleSimulateCoa}
              disabled={isGameOver || loading}
              className="w-full rounded border border-sky-500/60 bg-sky-950/60 py-2 text-xs font-mono font-semibold text-sky-300 hover:bg-sky-900/60 disabled:opacity-40"
            >
              Simulate COA (100x Monte Carlo)
            </button>
            <button
              onClick={handleCommitTurn}
              disabled={isGameOver || loading}
              className="w-full rounded bg-emerald-600 py-2.5 text-xs font-mono font-bold text-slate-950 hover:bg-emerald-500 disabled:opacity-40"
            >
              Execute Turn Adjudication
            </button>
          </div>
        </aside>

        {/* Center Map Canvas */}
        <main className="col-span-6 h-full overflow-hidden">
          <TacticalMap
            gameState={gameState}
            selectedUnitId={selectedUnitId}
            activeOrderType={activeOrderType}
            validTargetKeys={validTargetKeys}
            blueOrders={blueOrders}
            heatmap={coaReport?.hex_threat_heatmap ?? {}}
            onSelectUnit={handleSelectUnit}
            onSelectHex={handleSelectHex}
          />
        </main>

        {/* Right Sidebar: Monte Carlo COA Analytics & Adjudication Log */}
        <aside className="col-span-3 flex flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Monte Carlo COA Evaluation (N=100)
          </h2>
          {coaReport ? (
            <div className="space-y-3 rounded border border-sky-900/60 bg-slate-950 p-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Corridor Hold Probability:</span>
                <span
                  className={`font-bold ${
                    coaReport.survival_probability >= 0.7
                      ? 'text-emerald-400'
                      : coaReport.survival_probability >= 0.4
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {Math.round(coaReport.survival_probability * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Blue Strength:</span>
                <span>{coaReport.expected_blue_strength}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Red Attrition:</span>
                <span className="text-amber-400">+{coaReport.expected_red_attrition}%</span>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <div className="mb-1 text-sky-400 font-semibold">
                  JISR &amp; Decision Support Advisories:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {coaReport.tactical_recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400 font-mono">
              Plot Blue orders or click &ldquo;Simulate COA&rdquo; to compute 100 stochastic rollouts over the next 5 turns and generate threat heatmaps.
            </div>
          )}

          <h2 className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-400">
            JISR &amp; Combat Adjudication Log
          </h2>
          <div className="flex-1 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] space-y-1.5 text-slate-300">
            {gameState.combat_log.map((entry, idx) => (
              <div key={idx} className="leading-relaxed">
                {entry}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </aside>
      </div>
    </div>
  );
};
