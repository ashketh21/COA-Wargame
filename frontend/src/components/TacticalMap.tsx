import React from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import ms from 'milsymbol';
import { GameState, HexTile, OrderType, Unit, UnitOrder } from '../types/wargame';

interface TacticalMapProps {
  gameState: GameState;
  selectedUnitId: string | null;
  activeOrderType: OrderType;
  validTargetKeys: Set<string>;
  blueOrders: Record<string, UnitOrder>;
  heatmap: Record<string, number>;
  onSelectUnit: (unitId: string) => void;
  onSelectHex: (q: number, r: number) => void;
}

// Georeferenced to the real Daugava River line:
// q=3, r=1 -> Jekabpils Bridge (56.4994°N, 25.8783°E)
// q=3, r=6 -> Daugavpils Unity Bridge (55.8659°N, 26.5119°E)
const ORIGIN_LAT = 56.6261;
const ORIGIN_LNG = 24.9913;
const HEX_RADIUS_LAT = 0.08447;
const HEX_RADIUS_LNG = 0.14632;

export function hexToLatLng(q: number, r: number): [number, number] {
  const lat = ORIGIN_LAT - r * HEX_RADIUS_LAT * 1.5;
  const lng = ORIGIN_LNG + (q + r * 0.5) * HEX_RADIUS_LNG * Math.sqrt(3);
  return [lat, lng];
}

function getHexCorners(q: number, r: number): [number, number][] {
  const [centerLat, centerLng] = hexToLatLng(q, r);
  const corners: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i - 30);
    corners.push([
      centerLat + HEX_RADIUS_LAT * Math.sin(angleRad),
      centerLng + HEX_RADIUS_LNG * Math.cos(angleRad),
    ]);
  }
  return corners;
}

const TERRAIN_COLORS: Record<string, string> = {
  CLEAR: '#1e293b',
  HIGHWAY: '#d97706',
  FOREST: '#065f46',
  URBAN: '#64748b',
  RIVER: '#0369a1',
  RIVER_BRIDGE: '#0284c7',
};

function createNatoIcon(unit: Unit, isSelected: boolean): L.DivIcon {
  const symbol = new ms.Symbol(unit.siddc, {
    size: 28,
    uniqueDesignation: `${Math.round(unit.strength)}%`,
    outlineColor: isSelected ? '#10b981' : '#020617',
    outlineWidth: isSelected ? 4 : 2,
  });

  return L.divIcon({
    html: `<div class="relative flex flex-col items-center">${symbol.asSVG()}</div>`,
    className: 'nato-unit-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function createUnknownContactIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-amber-400 bg-amber-950/80 font-mono text-sm font-bold text-amber-300 shadow-lg">?</div>`,
    className: 'unknown-contact-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  gameState,
  selectedUnitId,
  activeOrderType,
  validTargetKeys,
  blueOrders,
  heatmap,
  onSelectUnit,
  onSelectHex,
}) => {
  return (
    <MapContainer
      center={[56.18, 26.58]}
      zoom={8}
      className="h-full w-full rounded-lg border border-slate-800 shadow-inner"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="tactical-map-tiles"
      />

      {gameState.tiles.map((tile: HexTile) => {
        const key = `${tile.q},${tile.r}`;
        const threat = heatmap[key] ?? 0;
        const isValidTarget = validTargetKeys.has(key);
        const isRiver = tile.terrain === 'RIVER';

        const fillColor =
          threat > 0
            ? threat >= 0.45
              ? '#ef4444'
              : '#f97316'
            : TERRAIN_COLORS[tile.terrain] || '#1e293b';

        let strokeColor = '#334155';
        let strokeWeight = 1;
        if (tile.is_objective) {
          strokeColor = '#38bdf8';
          strokeWeight = 2.5;
        } else if (isRiver) {
          strokeColor = '#0ea5e9';
          strokeWeight = 1.5;
        }

        if (isValidTarget) {
          strokeColor = activeOrderType === 'FIRE_SUPPORT' ? '#fb7185' : '#34d399';
          strokeWeight = 2.5;
        }

        const baseOpacity = isRiver ? 0.58 : 0.28;
        const fillOpacity =
          threat > 0
            ? Math.min(0.65, 0.2 + threat)
            : isValidTarget
            ? Math.max(baseOpacity, 0.36)
            : baseOpacity;

        return (
          <Polygon
            key={key}
            positions={getHexCorners(tile.q, tile.r)}
            pathOptions={{
              color: strokeColor,
              weight: strokeWeight,
              dashArray: isValidTarget && activeOrderType === 'FIRE_SUPPORT' ? '4, 4' : undefined,
              fillColor,
              fillOpacity,
            }}
            eventHandlers={{
              click: () => onSelectHex(tile.q, tile.r),
            }}
          >
            <Tooltip direction="center" opacity={0.9}>
              <div className="text-xs font-mono">
                <strong>Hex ({tile.q},{tile.r})</strong> — {tile.terrain}
                {tile.label && <div className="text-sky-400 font-semibold">{tile.label}</div>}
                {isValidTarget && (
                  <div className={activeOrderType === 'FIRE_SUPPORT' ? 'text-rose-400' : 'text-emerald-400'}>
                    Click to plot {activeOrderType}
                  </div>
                )}
                {threat > 0 && (
                  <div className="text-rose-400">
                    COA Threat Probability: {Math.round(threat * 100)}%
                  </div>
                )}
              </div>
            </Tooltip>
          </Polygon>
        );
      })}

      {/* Render Plotted Blue Order Vectors */}
      {Object.values(blueOrders).map((order) => {
        const unit = gameState.units.find((u) => u.id === order.unit_id);
        if (!unit || (order.target_q === unit.q && order.target_r === unit.r)) {
          return null;
        }
        return (
          <Polyline
            key={`order-${order.unit_id}`}
            positions={[
              hexToLatLng(unit.q, unit.r),
              hexToLatLng(order.target_q, order.target_r),
            ]}
            pathOptions={{
              color: order.order_type === 'FIRE_SUPPORT' ? '#f43f5e' : '#38bdf8',
              weight: 3,
              dashArray: order.order_type === 'FIRE_SUPPORT' ? '6, 6' : undefined,
            }}
          />
        );
      })}

      {/* Render Units with Real Fog of War */}
      {gameState.units
        .filter((u) => u.strength > 0)
        .map((unit) => {
          // Real Fog of War: Red units with <25% confidence are completely hidden
          if (unit.faction === 'RED' && !unit.detected_by_enemy && unit.detection_confidence < 0.25) {
            return null;
          }

          const isUnidentifiedRed = unit.faction === 'RED' && !unit.detected_by_enemy;

          return (
            <Marker
              key={unit.id}
              position={hexToLatLng(unit.q, unit.r)}
              icon={
                isUnidentifiedRed
                  ? createUnknownContactIcon()
                  : createNatoIcon(unit, unit.id === selectedUnitId)
              }
              eventHandlers={{
                click: () => {
                  if (unit.faction === 'BLUE') {
                    onSelectUnit(unit.id);
                  } else {
                    onSelectHex(unit.q, unit.r);
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                {isUnidentifiedRed ? (
                  <div className="text-xs font-mono">
                    <div className="font-bold text-amber-400">UNIDENTIFIED CONTACT</div>
                    <div className="text-slate-300">
                      SIGINT Track Confidence: {Math.round(unit.detection_confidence * 100)}%
                    </div>
                    <div className="text-rose-400">
                      Unconfirmed — Artillery suffers -50% blind-fire penalty.
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono">
                    <div className="font-bold">{unit.name}</div>
                    <div>
                      Strength: {unit.strength}% | Supply: {unit.supply}%
                    </div>
                    {unit.faction === 'RED' && (
                      <div className="text-emerald-400">
                        JISR Confirmed Track ({Math.round(unit.detection_confidence * 100)}%)
                      </div>
                    )}
                  </div>
                )}
              </Tooltip>
            </Marker>
          );
        })}
    </MapContainer>
  );
};
