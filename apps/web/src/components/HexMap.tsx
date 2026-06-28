import { useEffect, useRef, useState } from "react";
import {
  REGIONS,
  REGION_BY_KEY,
  STRUCTURE_BY_KEY,
  regionBuyCost,
  type Action,
  type GameState,
  type RegionKey,
} from "@wasted-realms/engine";
import { Map as MapIcon, Flag, Plus, Minus, SatelliteDish } from "lucide-react";
import { RegionDetail } from "./RegionDetail";
import { Bag } from "../ui/resources";
import { REGION_COLOR } from "../ui/regionColors";
import { empireHueMap, empireTileColor, canReconEnemies, NEUTRAL_HEX, UNCLAIMED_HEX } from "../ui/empireColors";
import { getStructureIconCanvas } from "../ui/iconBitmaps";
import { structureIcon } from "../ui/itemIcons";

const NEUTRAL = NEUTRAL_HEX; // visible grey for the legend swatch
const UNCLAIMED = UNCLAIMED_HEX; // unclaimed tile fill — matches the 3D planet
const BG: [number, number, number] = [7, 11, 17];
// Canvas backing-store sizing (HiDPI). The base Voronoi fill is O(dim²) so it's
// capped; the marker overlay is cheap (drawImage) so it renders at near-native res.
const MIN_DIM = 256;
const BASE_CAP = 640; // perf cap for the per-pixel Voronoi fill
const OVERLAY_CAP = 1280; // marker overlay can go higher (cheap)
const LOW_DIM = 320; // resolution used while actively zooming

type V = [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function HexMap({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [claimType, setClaimType] = useState<RegionKey>("agricultural");
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null); // Voronoi territory fill
  const overlayRef = useRef<HTMLCanvasElement>(null); // crisp marker layer (native res)
  const [dim, setDim] = useState(LOW_DIM); // base fill resolution (DPR, capped)
  const [overlayDim, setOverlayDim] = useState(LOW_DIM); // marker resolution (near-native)
  const [zooming, setZooming] = useState(false); // drop base res while actively zooming
  // Cached per-pixel tile-index map (geometry only) so selection/recon re-colors
  // don't re-run the expensive nearest-tile search — only camera moves rebuild it.
  const idxCache = useRef<{ sig: string; idx: Int32Array } | null>(null);
  const planet = game.planet;
  const me = game.empires[playerId];
  // While zooming we render the (expensive) fill at low res; settle to full res when idle.
  const renderDim = zooming ? Math.min(dim, LOW_DIM) : dim;

  // Size both canvases to the displayed square × devicePixelRatio (capped).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const recompute = () => {
      const dpr = window.devicePixelRatio || 1;
      const css = el.clientWidth || LOW_DIM;
      setDim(Math.max(MIN_DIM, Math.min(BASE_CAP, Math.round(css * dpr))));
      setOverlayDim(Math.max(MIN_DIM, Math.min(OVERLAY_CAP, Math.round(css * dpr))));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ZOOM_MIN = 0.6;
  const ZOOM_MAX = 6;
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  const colorById = empireHueMap(game);
  // Orbital reconnaissance (Defense Satellite) reveals rival region types/structures.
  const recon = canReconEnemies(game, playerId);

  const myTiles = me.regions.map((r) => r.tile).filter((t): t is number => t !== undefined);

  // Camera frame centred on the empire + the angular radius it (plus a margin) spans.
  let frame: { c: V; east: V; north: V; tanR: number; cosOuter: number } | null = null;
  if (myTiles.length > 0) {
    let cx = 0, cy = 0, cz = 0;
    for (const t of myTiles) {
      cx += planet.pos[t][0];
      cy += planet.pos[t][1];
      cz += planet.pos[t][2];
    }
    const c = norm([cx, cy, cz]);
    const up: V = Math.abs(c[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    const east = norm(cross(up, c));
    const north = cross(c, east);
    const maxAng = Math.max(...myTiles.map((t) => Math.acos(Math.min(1, dot(planet.pos[t], c)))));
    // Default framing shows the whole empire (maxAng) plus a small padding ring.
    // Zoom scales the visible angular radius: higher zoom → smaller radius → closer.
    const radius = Math.min(1.3, Math.max(0.06, (maxAng + 0.2) / zoom));
    const tanR = Math.tan(radius);
    // Square corners reach further than the edge midpoints; widen candidates to cover them.
    const cosOuter = Math.cos(Math.min(Math.PI / 2.05, Math.atan(tanR * Math.SQRT2) + 0.15));
    frame = { c, east, north, tanR, cosOuter };
  }

  // Per-tile fill colour. Your land matches the 3D planet: the empire-hue family
  // shaded per terrain type. Rivals stay solid empire blocks (fog of war, no
  // interior detail); unclaimed = near-black (same as the 3D planet).
  function tileColor(t: number): [number, number, number] {
    const o = planet.owner[t];
    if (!o) return hexToRgb(UNCLAIMED);
    // Your land uses the terrain palette (matches the detail panel & Overview).
    if (o === playerId) return hexToRgb(REGION_COLOR[planet.terrain[t]]);
    // Rivals: a flat identity hue until you have recon, then their hue FAMILY shaded
    // per terrain — so orbital recon reveals their region types.
    if (recon) return hexToRgb(empireTileColor(colorById[o] ?? UNCLAIMED, planet.terrain[t]));
    return hexToRgb(colorById[o] ?? UNCLAIMED);
  }

  // Gnomonic projection: a flat tangent plane at the empire centre. Fills the
  // whole rectangle (no circular cap edge), so the map reads as a flat map.
  function dirAt(X: number, Y: number, f: NonNullable<typeof frame>): V {
    return norm([
      f.c[0] + X * f.east[0] + Y * f.north[0],
      f.c[1] + X * f.east[1] + Y * f.north[1],
      f.c[2] + X * f.east[2] + Y * f.north[2],
    ]);
  }

  function nearestTile(d: V, cand: number[]): number {
    let best = cand[0];
    let bestDot = -Infinity;
    for (const t of cand) {
      const v = dot(d, planet.pos[t]);
      if (v > bestDot) {
        bestDot = v;
        best = t;
      }
    }
    return best;
  }

  // BASE layer: the filled Voronoi territory map. O(dim²) — rendered at the capped
  // (and, while zooming, reduced) resolution. Redraws on planet/selection/zoom/dim.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas || !frame) return;
    const f = frame;
    const D = renderDim;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1) Per-pixel tile index (nearest tile) — the expensive O(dim²·tiles) pass. It
    //    depends ONLY on the camera + tile geometry, so cache it by a geometry sig
    //    and reuse across selection/recon recolors.
    const sig = `${D}|${f.tanR.toFixed(5)}|${f.c[0].toFixed(4)},${f.c[1].toFixed(4)},${f.c[2].toFixed(4)}|${planet.size}`;
    let idx = idxCache.current?.sig === sig ? idxCache.current.idx : null;
    if (!idx) {
      const cand: number[] = [];
      for (let t = 0; t < planet.size; t++) if (dot(planet.pos[t], f.c) >= f.cosOuter) cand.push(t);
      idx = new Int32Array(D * D);
      for (let py = 0; py < D; py++) {
        const Y = (1 - (py / D) * 2) * f.tanR;
        for (let px = 0; px < D; px++) {
          const X = ((px / D) * 2 - 1) * f.tanR;
          idx[py * D + px] = cand.length ? nearestTile(dirAt(X, Y, f), cand) : -1;
        }
      }
      idxCache.current = { sig, idx };
    }

    // 2) Paint RGBA from the (cached) index map — cheap array lookups, no search.
    const colorCache = new Map<number, [number, number, number]>();
    const colorOf = (t: number) => {
      let c = colorCache.get(t);
      if (!c) {
        c = tileColor(t);
        colorCache.set(t, c);
      }
      return c;
    };
    const img = ctx.createImageData(D, D);
    const data = img.data;
    for (let p = 0; p < idx.length; p++) {
      const t = idx[p];
      let rgb = BG;
      if (t >= 0) {
        rgb = colorOf(t);
        if (t === sel) rgb = [Math.min(255, rgb[0] + 90), Math.min(255, rgb[1] + 110), 255];
      }
      const i = p * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planet, sel, zoom, renderDim, recon]);

  // OVERLAY layer: structure-icon markers at near-native resolution (crisp glyphs).
  // Cheap (drawImage of cached bitmaps), so it always renders at full overlayDim.
  // Fog-of-war: your own structures always; rivals' only once you have recon.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !frame) return;
    const f = frame;
    const D = overlayDim;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, D, D);
    const mr = Math.max(8, D * 0.026); // marker radius (glyphs need more room than a dot)
    for (let t = 0; t < planet.size; t++) {
      const owned = planet.owner[t] === playerId;
      const structure = planet.structure[t];
      if ((!owned && !recon) || !structure || !planet.owner[t]) continue;
      const d = planet.pos[t];
      const dc = dot(d, f.c);
      if (dc <= 0.001) continue; // behind the tangent point — off-map
      const X = dot(d, f.east) / dc;
      const Y = dot(d, f.north) / dc;
      const mx = ((X / f.tanR) + 1) / 2 * D;
      const my = (1 - Y / f.tanR) / 2 * D;
      if (mx < -mr || mx > D + mr || my < -mr || my > D + mr) continue;
      const bmp = getStructureIconCanvas(structure, {
        px: 96,
        color: "#ffe9b0",
        disc: "rgba(6,9,14,0.82)",
      });
      if (bmp) {
        ctx.drawImage(bmp, mx - mr, my - mr, mr * 2, mr * 2);
      } else {
        ctx.beginPath();
        ctx.arc(mx, my, mr * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffe9b0";
        ctx.fill();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planet, zoom, recon, playerId, overlayDim]);

  // Wheel-to-zoom (non-passive so we can stop the page from scrolling). While the
  // wheel is active we flag `zooming` so the base fill drops to low res, then settles.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      setZoom((z) => clampZoom(z * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
      setZooming(true);
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => setZooming(false), 150);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      if (settle) clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (myTiles.length === 0 || !frame) {
    return (
      <Shell game={game} playerId={playerId}>
        <p className="font-display text-sm opacity-40">
          No territory yet. Claim land on the planet to begin.
        </p>
      </Shell>
    );
  }
  const f = frame;

  const handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const X = (((ev.clientX - rect.left) / rect.width) * 2 - 1) * f.tanR;
    const Y = (1 - ((ev.clientY - rect.top) / rect.height) * 2) * f.tanR;
    const d = dirAt(X, Y, f);
    const cand: number[] = [];
    for (let t = 0; t < planet.size; t++) if (dot(planet.pos[t], f.c) >= f.cosOuter) cand.push(t);
    setSel(nearestTile(d, cand));
  };

  const selOwner = sel !== null ? planet.owner[sel] : null;
  const selTerrain = sel !== null ? planet.terrain[sel] : null;
  const selStructure = sel !== null ? planet.structure[sel] : null;
  const selRegion =
    sel !== null && selOwner === playerId ? me.regions.find((r) => r.tile === sel) ?? null : null;

  return (
    <Shell game={game} playerId={playerId}>
      {/* Empire legend — top, with region counts (matches the 3D planet view). */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 font-display text-xs">
        {game.order.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: colorById[id] }} />
            {id === playerId ? "You" : game.empires[id].name}
            <span className="opacity-50">({game.empires[id].regions.length})</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 opacity-60">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NEUTRAL }} /> Frontier
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div
          ref={wrapRef}
          className="relative aspect-square w-full min-w-0 overflow-hidden rounded-md bg-[#070b11] lg:flex-1"
        >
          {/* Base: Voronoi territory fill (capped res). Overlay: crisp markers + input. */}
          <canvas
            ref={baseRef}
            width={renderDim}
            height={renderDim}
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: "auto" }}
          />
          <canvas
            ref={overlayRef}
            width={overlayDim}
            height={overlayDim}
            onClick={handleClick}
            className="absolute inset-0 h-full w-full cursor-pointer"
          />
          {/* Zoom controls */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-1">
            <ZoomBtn label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => clampZoom(z * 1.4))}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </ZoomBtn>
            <ZoomBtn label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => clampZoom(z / 1.4))}>
              <Minus className="h-4 w-4" strokeWidth={2.5} />
            </ZoomBtn>
          </div>
          {zoom !== 1 && (
            <button
              onClick={() => setZoom(1)}
              className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 font-display text-[11px] tabular-nums text-white/80 backdrop-blur transition-colors hover:text-[var(--color-accent)]"
              title="Reset zoom"
            >
              {zoom.toFixed(1)}× · reset
            </button>
          )}
        </div>

        <div className="min-w-0 w-full rounded-md border border-stone-200 p-3 dark:border-[var(--color-edge)] lg:w-1/4">
          {sel === null ? (
            <p className="font-display text-sm opacity-40">
              Click your land to build, a frontier tile to claim, or a neighbour to scout.
            </p>
          ) : selRegion ? (
            <RegionDetail region={selRegion} game={game} playerId={playerId} dispatch={dispatch} owned />
          ) : selOwner ? (
            <div className="space-y-1.5 font-display text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: colorById[selOwner] }} />
                <span className="font-semibold">{game.empires[selOwner]?.name}</span>
                <span className="ml-auto text-xs opacity-50">rival</span>
              </div>
              {recon ? (
                <>
                  {selTerrain && (
                    <div className="capitalize opacity-80">{REGION_BY_KEY.get(selTerrain)?.name}</div>
                  )}
                  {selStructure && (() => {
                    const SIcon = structureIcon(selStructure);
                    return (
                      <div className="inline-flex items-center gap-1.5 text-xs opacity-70">
                        <SIcon className="h-4 w-4 text-[var(--color-accent)]" />
                        {STRUCTURE_BY_KEY.get(selStructure)?.name ?? selStructure}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="inline-flex items-start gap-1.5 text-xs opacity-50">
                  <SatelliteDish className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Interior hidden — launch a Recon Satellite for orbital reconnaissance.
                </p>
              )}
            </div>
          ) : (
            <ClaimTile
              game={game}
              playerId={playerId}
              tile={sel}
              claimType={claimType}
              setClaimType={setClaimType}
              dispatch={dispatch}
            />
          )}
        </div>
      </div>

    </Shell>
  );
}

function ZoomBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded bg-black/50 text-white/80 backdrop-blur transition-colors hover:text-[var(--color-accent)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Shell({
  game,
  playerId,
  children,
}: {
  game: GameState;
  playerId: string;
  children: React.ReactNode;
}) {
  const me = game.empires[playerId];
  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <MapIcon className="h-3.5 w-3.5" /> Empire Map
        <span className="opacity-60">· {me.regions.length} regions</span>
        <span className="ml-auto normal-case opacity-60">your borders & frontier</span>
      </h2>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

function ClaimTile({
  game,
  playerId,
  tile,
  claimType,
  setClaimType,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  tile: number;
  claimType: RegionKey;
  setClaimType: (t: RegionKey) => void;
  dispatch: (a: Action) => void;
}) {
  const cost = regionBuyCost(claimType, 1);
  const credits = game.empires[playerId].resources.gold;
  let mine = 0, frontier = 0;
  for (const nb of game.planet.neighbors[tile] ?? []) {
    const o = game.planet.owner[nb];
    if (o === playerId) mine++;
    else if (!o) frontier++;
  }
  const reason =
    game.landPool <= 0
      ? "No land left to claim today"
      : mine === 0
        ? "Not adjacent to your territory"
        : credits < cost
          ? "Not enough credits"
          : null;
  return (
    <div className="space-y-2 font-display text-sm">
      <div className="flex items-center gap-2 opacity-70">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NEUTRAL }} /> Frontier tile
      </div>
      <div className="flex flex-wrap gap-x-3 font-display text-[11px] opacity-70">
        <span className="opacity-50">Adjacent</span>
        <span className="text-[var(--color-accent)]">{mine} yours</span>
        <span className="opacity-60">{frontier} frontier</span>
      </div>
      <label className="block text-xs opacity-60">Claim as</label>
      <select
        value={claimType}
        onChange={(e) => setClaimType(e.target.value as RegionKey)}
        className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 dark:border-[var(--color-edge)] dark:bg-[var(--color-void)] dark:text-stone-100"
      >
        {REGIONS.map((r) => (
          <option key={r.key} value={r.key} className="bg-white text-stone-900 dark:bg-[var(--color-void)] dark:text-stone-100">
            {r.name} ({regionBuyCost(r.key, 1)})
          </option>
        ))}
      </select>
      <div className="text-xs opacity-70">
        Yields <Bag bag={REGION_BY_KEY.get(claimType)?.income} sign="+" />
      </div>
      <button
        disabled={!!reason}
        onClick={() => dispatch({ kind: "BUY_REGION", regionType: claimType, qty: 1, tile })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 font-display text-sm text-black disabled:opacity-40"
      >
        <Flag className="h-4 w-4" /> Claim ({cost})
      </button>
      <p className="text-xs opacity-50">{reason ?? `${game.landPool} tiles left to claim today`}</p>
    </div>
  );
}
