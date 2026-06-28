import type { PlanetSize, RegionKey } from "./types.js";
import { makeRng } from "./rng.js";

/**
 * Tile capacity per planet-size preset. Bigger planets = more land to claim over
 * a longer game and more room for many empires. (Very large sizes will want
 * instanced rendering on the client; see Planet3D.)
 */
export const PLANET_SIZES: Record<PlanetSize, number> = {
  small: 300,
  medium: 600,
  large: 1000,
  extra: 1600,
  ultra: 2400,
};

/**
 * The shared planet: ONE canonical globe of fixed tiles that every empire lives
 * on. Each tile has a position (for rendering), a terrain type, an owner (an
 * empire id or null = neutral/unclaimed) and an optional structure. Empires start
 * at roughly equidistant homes; unclaimed land between them is the contested
 * frontier (BRE/SRE land faucet). Pure + deterministic from (size, seed).
 */
export interface Planet {
  /** Total tile count. */
  size: number;
  /** Unit-sphere position per tile (for 3D/2D projection). */
  pos: [number, number, number][];
  /** Terrain type per tile. */
  terrain: RegionKey[];
  /** Owning empire id per tile, or null if unclaimed. */
  owner: (string | null)[];
  /** Structure key built on the tile, or null. */
  structure: (string | null)[];
  /** Adjacency: neighbour tile indices per tile (for synergy + map borders). */
  neighbors: number[][];
}

// Terrain mix for neutral/unclaimed tiles (weighted). Owned tiles keep the
// empire's own starting region types; this only fills the wilderness.
const TERRAIN_WEIGHTS: [RegionKey, number][] = [
  ["agricultural", 5],
  ["mountain", 4],
  ["desert", 4],
  ["urban", 3],
  ["industrial", 3],
  ["river", 2],
  ["coastal", 2],
  ["technology", 1],
];

/** Even point distribution on a sphere (Fibonacci spiral) — unit vectors. */
function fibonacciSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2; // 1 → -1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** k nearest tiles (by angular distance) for each tile — the hex-like border graph. */
function computeNeighbors(
  pos: [number, number, number][],
  k: number,
): number[][] {
  return pos.map((p, i) => {
    const scored = pos
      .map((q, j) => ({ j, d: dot(p, q) })) // larger dot = closer
      .filter((s) => s.j !== i)
      .sort((a, b) => b.d - a.d)
      .slice(0, k)
      .map((s) => s.j);
    return scored;
  });
}

/** Pick `n` roughly-equidistant tiles (farthest-point sampling) for empire homes. */
function equidistantHomes(pos: [number, number, number][], n: number): number[] {
  if (n <= 0) return [];
  const homes = [0];
  while (homes.length < n) {
    let best = -1;
    let bestDist = -Infinity;
    for (let i = 0; i < pos.length; i++) {
      if (homes.includes(i)) continue;
      // distance to the nearest existing home (we want to maximise it)
      let nearest = Infinity;
      for (const h of homes) {
        const ang = 1 - dot(pos[i], pos[h]); // 0 (same) … 2 (antipodal)
        if (ang < nearest) nearest = ang;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = i;
      }
    }
    if (best < 0) break;
    homes.push(best);
  }
  return homes;
}

/** A blank planet (all neutral) of `size` tiles with seeded terrain. */
export function makePlanet(size: number, seed: number): Planet {
  const pos = fibonacciSphere(size);
  const rng = makeRng(seed >>> 0);
  const total = TERRAIN_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const terrain: RegionKey[] = pos.map(() => {
    let r = rng.next() * total;
    for (const [k, w] of TERRAIN_WEIGHTS) {
      r -= w;
      if (r <= 0) return k;
    }
    return "agricultural";
  });
  return {
    size,
    pos,
    terrain,
    owner: pos.map(() => null),
    structure: pos.map(() => null),
    neighbors: computeNeighbors(pos, 6),
  };
}

/**
 * Claim a compact cluster of `count` tiles around `home` for `empireId`: the
 * `count` NEAREST unclaimed tiles by angular distance. Nearest-N (not graph BFS)
 * guarantees the cluster's Voronoi cells are genuinely contiguous, so territory
 * renders as one solid area instead of fragmenting on dense (large) planets.
 */
export function claimCluster(
  planet: Planet,
  empireId: string,
  home: number,
  types: RegionKey[],
): number[] {
  const hp = planet.pos[home];
  const nearest = planet.pos
    .map((p, t) => ({ t, d: dot(p, hp) }))
    .filter((x) => planet.owner[x.t] === null)
    .sort((a, b) => b.d - a.d) // closest (largest dot) first
    .slice(0, types.length)
    .map((x) => x.t);
  const claimed: number[] = [];
  for (const t of nearest) {
    const type = types[claimed.length];
    planet.owner[t] = empireId;
    planet.terrain[t] = type;
    claimed.push(t);
  }
  return claimed;
}

/** Place `empireCount` empires at equidistant homes and claim their starting clusters. */
export function placeEmpires(
  planet: Planet,
  empires: { id: string; types: RegionKey[] }[],
): Record<string, number[]> {
  const homes = equidistantHomes(planet.pos, empires.length);
  const result: Record<string, number[]> = {};
  empires.forEach((e, i) => {
    result[e.id] = claimCluster(planet, e.id, homes[i], e.types);
  });
  return result;
}

/** Fraction (0..1) of all claimed land owned by an empire — for the domination win. */
export function landShare(planet: Planet, empireId: string): number {
  let owned = 0;
  let claimed = 0;
  for (const o of planet.owner) {
    if (o === null) continue;
    claimed++;
    if (o === empireId) owned++;
  }
  return claimed === 0 ? 0 : owned / claimed;
}

/** Clone a planet copying only the mutable arrays (pos/neighbors are immutable). */
export function clonePlanet(p: Planet): Planet {
  return {
    ...p,
    owner: p.owner.slice(),
    terrain: p.terrain.slice(),
    structure: p.structure.slice(),
  };
}

/** Neutral tiles bordering an empire's territory — the only land it may claim next. */
export function frontierTiles(planet: Planet, empireId: string): number[] {
  const out: number[] = [];
  for (let t = 0; t < planet.size; t++) {
    if (planet.owner[t] !== null) continue;
    if (planet.neighbors[t].some((nb) => planet.owner[nb] === empireId)) out.push(t);
  }
  return out;
}
