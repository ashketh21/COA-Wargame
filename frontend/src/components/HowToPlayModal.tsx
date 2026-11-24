import React from 'react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              CAF Operational Planning Process (OPP) Briefing
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-tight">
              How to Play — Operation REASSURANCE COA Wargame
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-mono text-slate-300 hover:bg-slate-700"
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-300">
          {/* 1. Mission Objective */}
          <section className="rounded-lg border border-sky-900/60 bg-sky-950/30 p-4">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
              1. Operational Mission &amp; Victory Condition
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              You command forward elements of the <strong>CAF-led NATO Multinational Brigade – Latvia (MNB-LVA)</strong> deployed under <strong>Operation REASSURANCE</strong> (operating out of Camp Ādaži).
              The <strong>Daugava River (column q=3)</strong> is impassable to ground units except at two real strategic crossings: <strong>Jēkabpils Bridge</strong>{' '}
              <code className="text-sky-300">(3,1)</code> and <strong>Daugavpils Unity Bridge</strong> <code className="text-sky-300">(3,6)</code>. Hold both crossings and{' '}
              <code className="text-sky-300">FOB Sēlpils (2,1)</code> for <strong>8 Turns</strong> (or neutralize all Red maneuver units) while keeping average Blue ground strength at or above <strong>35%</strong>.
            </p>
          </section>

          {/* 2. Your Units */}
          <section>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              2. Blue Task Force ORBAT (NATO APP-6 Symbology)
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              <div className="rounded border border-slate-800 bg-slate-950 p-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-100">
                  <span className="rounded bg-sky-900/80 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">MECH INF</span>
                  1 RCR Mechanized Coy (LAV 6.0)
                </div>
                <p className="mt-1 text-slate-400">
                  Start: <code className="text-emerald-400">(3,1)</code> at Jēkabpils Bridge. Balanced infantry defender excelling at holding river crossings, forests, and urban terrain.
                </p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-100">
                  <span className="rounded bg-emerald-900/80 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">ARMOR</span>
                  LdSH(RC) Leopard 2A4M Sqn
                </div>
                <p className="mt-1 text-slate-400">
                  Start: <code className="text-emerald-400">(3,6)</code> at Daugavpils Unity Bridge. Heavy armor with the highest direct combat power (38), anchoring the southern A6 approach.
                </p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-100">
                  <span className="rounded bg-amber-900/80 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">ISR UAS</span>
                  4 ISR Tactical UAS Det (Blackjack)
                </div>
                <p className="mt-1 text-slate-400">
                  Start: <code className="text-emerald-400">(4,3)</code>. Flies up to 2 hexes/turn over rivers, immune to ground melee (keep 2+ hexes away to avoid SHORAD/EW). Unmasks hidden Red units and grants <strong>+30% to +45% artillery spotting bonus</strong> within 3 hexes.
                </p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-100">
                  <span className="rounded bg-rose-900/80 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">ARTILLERY</span>
                  2 RCHA M777 Howitzer Battery
                </div>
                <p className="mt-1 text-slate-400">
                  Start: <code className="text-emerald-400">(2,3)</code> on the west bank of the Daugava. Long-range indirect fire (<strong>5-hex range</strong>) covering both crossings; fires <em>before</em> ground units move.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Step-by-Step Turn Workflow */}
          <section>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
              3. Step-by-Step Turn Workflow (Action – Reaction – Counteraction)
            </h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs">
              <li>
                <strong>Select a Friendly Unit:</strong> Click any Blue unit in the left sidebar or on the map. Valid order modes for that unit appear automatically.
              </li>
              <li>
                <strong>Pick an Order Mode &amp; Valid Highlighted Hex:</strong>
                <ul className="mt-1 list-disc pl-4 text-slate-400 space-y-0.5">
                  <li><strong className="text-slate-200">HOLD:</strong> Dig-in on current hex for a <strong>+25% defense bonus</strong>.</li>
                  <li><strong className="text-emerald-300">MOVE:</strong> Click a green-highlighted hex (1 hex for ground units, 2 hexes for UAS; ground units cannot enter River hexes).</li>
                  <li><strong className="text-sky-300">RECON_SWEEP:</strong> (UAS) Expands sensor radius by +1 hex, boosts track confidence +20%, and upgrades artillery spotting to +45%.</li>
                  <li><strong className="text-rose-400">FIRE_SUPPORT:</strong> (M777 Artillery) Click any rose-highlighted hex within 5 hexes to fire a 155mm barrage (10% supply).</li>
                </ul>
              </li>
              <li>
                <strong>Simulate COA (100x Monte Carlo):</strong> Run 100 stochastic rollouts over the next 5 turns to inspect Corridor Hold Probability, breach heatmaps, and JISR advisories before committing.
              </li>
              <li>
                <strong>Execute Turn Adjudication:</strong> Resolves in doctrinal order: <em>Air/JISR Fusion → Indirect Fires → Ground Maneuver → Direct Contact → Mission Check</em>.
              </li>
            </ol>
          </section>

          {/* 4. Terrain & Fog of War Legend */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="font-mono font-bold uppercase text-slate-300">Terrain Defense Modifiers</div>
              <ul className="mt-1.5 space-y-1 text-slate-400 font-mono">
                <li><span className="inline-block w-3 h-3 rounded-sm bg-sky-700 mr-2 align-middle"></span>Daugava River: <strong>Impassable (Ground)</strong></li>
                <li><span className="inline-block w-3 h-3 rounded-sm bg-sky-500 mr-2 align-middle"></span>River Bridge (Objective): <strong>1.40x Defense</strong></li>
                <li><span className="inline-block w-3 h-3 rounded-sm bg-slate-500 mr-2 align-middle"></span>Urban / FOB (Objective): <strong>1.50x Defense</strong></li>
                <li><span className="inline-block w-3 h-3 rounded-sm bg-emerald-800 mr-2 align-middle"></span>Forest Cover: <strong>1.35x Defense (-20% Sensor)</strong></li>
                <li><span className="inline-block w-3 h-3 rounded-sm bg-amber-600 mr-2 align-middle"></span>Highway Corridor: <strong>0.95x Defense</strong></li>
              </ul>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="font-mono font-bold uppercase text-slate-300">Real Fog of War &amp; Blind-Fire Penalty</div>
              <p className="mt-1.5 text-slate-400">
                Red units below <strong>25% confidence</strong> are completely hidden. Between <strong>25%–54%</strong>, they appear only as amber <code className="text-amber-300">?</code> SIGINT contacts—and shelling unconfirmed targets suffers a <strong>-50% blind-fire penalty</strong>. Use your UAS to confirm tracks (&ge;55%) before firing!
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-emerald-500"
          >
            Enter Command Center
          </button>
        </div>
      </div>
    </div>
  );
};
