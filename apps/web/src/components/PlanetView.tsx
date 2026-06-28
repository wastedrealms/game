import { Suspense, lazy, useMemo, useState } from "react";
import {
  REGIONS,
  REGION_BY_KEY,
  STRUCTURE_BY_KEY,
  regionBuyCost,
  type Action,
  type GameState,
  type RegionKey,
} from "@wasted-realms/engine";
import { Globe, Loader, Flag, SatelliteDish } from "lucide-react";
import { structureIcon } from "../ui/itemIcons";
import { RegionDetail } from "./RegionDetail";
import { REGION_COLOR } from "../ui/regionColors";
import { Bag } from "../ui/resources";
import {
  empireHueMap,
  empireTileColor,
  canReconEnemies,
  NEUTRAL_HEX,
  UNCLAIMED_HEX,
} from "../ui/empireColors";

/** Summarise who owns the tiles adjacent to a given tile. */
function neighborSummary(game: GameState, playerId: string, tile: number) {
  let mine = 0, rival = 0, frontier = 0;
  for (const nb of game.planet.neighbors[tile] ?? []) {
    const o = game.planet.owner[nb];
    if (o === playerId) mine++;
    else if (o) rival++;
    else frontier++;
  }
  return { mine, rival, frontier };
}

// Code-split the three.js bundle — only loaded when the Planet tab is opened.
const Planet3D = lazy(() => import("./Planet3D"));

const NEUTRAL = NEUTRAL_HEX; // visible grey for legend swatches
const NEUTRAL_DIM = UNCLAIMED_HEX; // unclaimed wilderness reads as black on the globe

/** Compact "Adjacent: 3 yours · 1 rival · 2 frontier" line. */
function Adjacency({ nb }: { nb: { mine: number; rival: number; frontier: number } }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-display text-[11px] opacity-70">
      <span className="opacity-50">Adjacent</span>
      <span className="text-[var(--color-accent)]">{nb.mine} yours</span>
      {nb.rival > 0 && <span className="text-red-400">{nb.rival} rival</span>}
      <span className="opacity-60">{nb.frontier} frontier</span>
    </div>
  );
}

export function PlanetView({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const [selTile, setSelTile] = useState<number | null>(null);
  const [claimType, setClaimType] = useState<RegionKey>("agricultural");
  const planet = game.planet;
  // Focus target = [dirX, dirY, dirZ, cameraDistance]; the distance frames the whole
  // empire so it isn't clipped. On open: orient toward the PLAYER's realm but zoomed
  // OUT to show the entire planet with a margin (not the default +Z view).
  const [focus, setFocus] = useState<[number, number, number, number] | null>(() => {
    const f = focusOn(playerId);
    return f ? [f[0], f[1], f[2], 7] : null; // 7 ≈ whole globe + a little gap (R=2)
  });

  // Centroid direction of an empire's tiles + a camera distance that frames its
  // angular spread (zoom out for big/scattered empires so nothing clips).
  function focusOn(id: string): [number, number, number, number] | null {
    const tiles = game.empires[id].regions.map((r) => r.tile).filter((t): t is number => t !== undefined);
    if (tiles.length === 0) return null;
    let x = 0, y = 0, z = 0;
    for (const t of tiles) {
      x += planet.pos[t][0];
      y += planet.pos[t][1];
      z += planet.pos[t][2];
    }
    const len = Math.hypot(x, y, z) || 1;
    const n: [number, number, number] = [x / len, y / len, z / len];
    // Half-angle of the empire's cap (max angle of any tile from the centroid).
    let maxAng = 0;
    for (const t of tiles) {
      const p = planet.pos[t];
      const d = Math.max(-1, Math.min(1, p[0] * n[0] + p[1] * n[1] + p[2] * n[2]));
      maxAng = Math.max(maxAng, Math.acos(d));
    }
    // Distance so the cap rim stays inside ~20° of the view axis (R = planet radius = 2).
    const R = 2;
    const aTarget = (20 * Math.PI) / 180;
    const dist = Math.min(9, Math.max(3.4, R * Math.cos(maxAng) + (R * Math.sin(maxAng)) / Math.tan(aTarget) + 0.4));
    return [n[0], n[1], n[2], dist];
  }

  // Stable colour per empire (player = accent).
  const colorById = empireHueMap(game);
  const colorFor = (owner: string | null) => (owner ? colorById[owner] ?? NEUTRAL : NEUTRAL);
  // Orbital reconnaissance (Defense Satellite) reveals rival region types/structures.
  const recon = canReconEnemies(game, playerId);

  // Per-tile surface colour: YOUR land uses the terrain palette (so it matches the
  // detail panel and the Overview composition bar); rivals are a single flat identity
  // hue (their base colour) so territory ownership reads at a glance.
  const tileColors = useMemo(
    () =>
      planet.pos.map((_, i) => {
        const o = planet.owner[i];
        if (!o) return NEUTRAL_DIM;
        if (o === playerId) return REGION_COLOR[planet.terrain[i]];
        // Rivals: flat identity hue until recon, then their hue FAMILY shaded per terrain.
        if (recon) return empireTileColor(colorById[o] ?? NEUTRAL, planet.terrain[i]);
        return colorById[o] ?? NEUTRAL;
      }),
    // colorById is derived from stable order/playerId
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planet],
  );

  // Tiles whose structure marker should show: yours always; rivals' only with recon.
  const markerTiles = useMemo(
    () =>
      planet.structure.reduce<number[]>((acc, s, i) => {
        const o = planet.owner[i];
        if (s && o && (o === playerId || recon)) acc.push(i);
        return acc;
      }, []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planet, recon],
  );

  const owner = selTile !== null ? planet.owner[selTile] : null;
  const terrain = selTile !== null ? planet.terrain[selTile] : null;
  const structure = selTile !== null ? planet.structure[selTile] : null;
  const isMine = owner === playerId;
  const myRegion = isMine
    ? game.empires[playerId].regions.find((r) => r.tile === selTile) ?? null
    : null;

  const claimed = game.order.reduce((n, id) => n + game.empires[id].regions.length, 0);

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <Globe className="h-3.5 w-3.5" /> Shared Planet · {claimed}/{planet.size} tiles claimed
        <span className="ml-auto normal-case opacity-60">right-drag to rotate</span>
      </h2>

      {/* Empire legend (no divider; spacing matches the 2D map) */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 px-4 pt-3">
        {game.order.map((id) => (
          <button
            key={id}
            onClick={() => setFocus(focusOn(id))}
            title="Center the planet on this empire"
            className="inline-flex items-center gap-1.5 font-display text-xs transition-opacity hover:text-[var(--color-accent)]"
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: colorById[id] }}
            />
            {id === playerId ? "You" : game.empires[id].name}
            <span className="opacity-50">({game.empires[id].regions.length})</span>
          </button>
        ))}
        <span className="inline-flex items-center gap-1.5 font-display text-xs opacity-60">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NEUTRAL }} />
          Frontier
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 lg:flex-row">
        <div className="aspect-square w-full min-w-0 overflow-hidden rounded-md bg-[#05070b] lg:flex-1">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center font-display text-sm opacity-50">
                <Loader className="mr-2 h-4 w-4 animate-spin" /> Booting orbital view…
              </div>
            }
          >
            <Planet3D
              planet={planet}
              tileColors={tileColors}
              selectedTile={selTile}
              onSelect={setSelTile}
              focus={focus}
              onInteract={() => setFocus(null)}
              markerTiles={markerTiles}
            />
          </Suspense>
        </div>

        <div className="min-w-0 w-full rounded-md border border-stone-200 p-3 dark:border-[var(--color-edge)] lg:w-1/4">
          {selTile === null ? (
            <p className="font-display text-sm opacity-40">
              Right-drag to spin the planet. Click a tile to inspect it.
            </p>
          ) : isMine && myRegion ? (
            <RegionDetail
              region={myRegion}
              game={game}
              playerId={playerId}
              dispatch={dispatch}
              owned
            />
          ) : owner ? (
            // Rival territory — strategic overview (shared planet shows all).
            (() => {
              const nb = neighborSummary(game, playerId, selTile);
              const def = terrain ? REGION_BY_KEY.get(terrain) : null;
              return (
                <div className="space-y-2 font-display text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: colorFor(owner) }} />
                    <span className="font-semibold">{game.empires[owner]?.name}</span>
                    <span className="ml-auto text-xs opacity-50">rival</span>
                  </div>
                  {recon ? (
                    <>
                      {def && (
                        <div className="capitalize" style={{ color: REGION_COLOR[terrain!] }}>
                          {def.name}
                        </div>
                      )}
                      {structure && (() => {
                        const SIcon = structureIcon(structure);
                        return (
                          <div className="inline-flex items-center gap-1.5 text-xs opacity-70">
                            <SIcon className="h-4 w-4 text-[var(--color-accent)]" />
                            {STRUCTURE_BY_KEY.get(structure)?.name ?? structure}
                          </div>
                        );
                      })()}
                      <Adjacency nb={nb} />
                    </>
                  ) : (
                    <p className="inline-flex items-start gap-1.5 text-xs opacity-50">
                      <SatelliteDish className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Interior hidden — launch a Recon Satellite for orbital reconnaissance.
                    </p>
                  )}
                </div>
              );
            })()
          ) : (
            // Neutral tile — claim it as a region of your chosen type.
            (() => {
              const cost = regionBuyCost(claimType, 1);
              const credits = game.empires[playerId].resources.gold;
              const nb = neighborSummary(game, playerId, selTile);
              const reason =
                game.landPool <= 0
                  ? "No land left to claim today"
                  : nb.mine === 0
                    ? "Not adjacent to your territory"
                    : credits < cost
                      ? "Not enough credits"
                      : null;
              return (
                <div className="space-y-2 font-display text-sm">
                  <div className="flex items-center gap-2 opacity-70">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NEUTRAL }} />
                    Unclaimed frontier
                  </div>
                  <Adjacency nb={nb} />
                  <label className="block text-xs opacity-60">Claim as</label>
                  <select
                    value={claimType}
                    onChange={(e) => setClaimType(e.target.value as RegionKey)}
                    className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 dark:border-[var(--color-edge)] dark:bg-[var(--color-void)] dark:text-stone-100"
                  >
                    {REGIONS.map((r) => (
                      <option
                        key={r.key}
                        value={r.key}
                        className="bg-white text-stone-900 dark:bg-[var(--color-void)] dark:text-stone-100"
                      >
                        {r.name} ({regionBuyCost(r.key, 1)})
                      </option>
                    ))}
                  </select>
                  {/* What this region will yield once claimed. */}
                  <div className="text-xs opacity-70">
                    Yields <Bag bag={REGION_BY_KEY.get(claimType)?.income} sign="+" />
                  </div>
                  <button
                    disabled={!!reason}
                    onClick={() =>
                      dispatch({ kind: "BUY_REGION", regionType: claimType, qty: 1, tile: selTile! })
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 font-display text-sm text-black disabled:opacity-40"
                  >
                    <Flag className="h-4 w-4" /> Claim ({cost})
                  </button>
                  <p className="text-xs opacity-50">{reason ?? `${game.landPool} tiles left to claim today`}</p>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </section>
  );
}
