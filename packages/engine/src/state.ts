import type { GameConfig, RegionKey, Resource, TreatyType } from "./types.js";
import { DEFAULT_GAME_CONFIG } from "./data/gameConfig.js";
import { makePlanet, placeEmpires, type Planet } from "./planet.js";

/** A full resource ledger (all five resources always present). */
export type ResourceLedger = Record<Resource, number>;

/** An owned terrain tile, optionally hosting one economic structure. */
export interface OwnedRegion {
  id: string;
  type: RegionKey;
  /** Key of the economic (R-class) structure built here, if any. */
  structure?: string;
  /** Index of this region's tile on the shared planet (see planet.ts). */
  tile?: number;
}

/** A single empire's mutable game state (player or NPC). */
export interface EmpireState {
  id: string;
  name: string;
  isNpc: boolean;
  resources: ResourceLedger;
  /** Population in millions (source scale). */
  population: number;
  /** Popular support, 0–100. */
  popularSupport: number;
  /** Tax rate, 0–100. */
  taxRate: number;
  regions: OwnedRegion[];
  /** Empire-level military structures: structure key → count built. */
  militaryStructures: Record<string, number>;
  /** Units owned: unit key → number of individual units (always a multiple of batch). */
  units: Record<string, number>;
  /** Turns available to spend (computed via lazy accrual; see rules.accrueTurns). */
  turns: number;
  /** Timestamp (ms) of the last turn accrual — basis for lazy accrual. */
  lastAccrualAt: number;
  /** Remaining newbie-protection turns (can't be attacked / can't attack). */
  protectionTurnsLeft: number;
  /** Total turns this empire has played (drives the Turn/Day counter). */
  turnsPlayed: number;
  /** Monotonic counter for minting deterministic, collision-free region ids. */
  regionSeq: number;
  /** Cached net worth (recomputed each tick). */
  netWorth: number;
  /** Attacks launched today (anti-grief cap; reset lazily on day rollover). */
  attacksToday: number;
  /** Day index of the current `attacksToday` count (lazy reset basis). */
  attackDay: number;
  /** Anti-farming: per target id → last attack turn + accumulated "heat". */
  recentHits: Record<string, { turn: number; heat: number }>;
  /** Accumulated Research Points (spent to unlock tech milestones). */
  research: number;
  /** Unlocked tech milestone keys (see data/tech.ts). */
  tech: string[];
  /** Presentation-only identity colour (hex), chosen at setup. */
  hue?: string;
}

/** A pairwise diplomatic treaty between two empires. */
export interface Treaty {
  /** Empire ids, stored sorted so (a,b) and (b,a) are the same treaty. */
  a: string;
  b: string;
  type: TreatyType;
  since: number;
}

/** A news/log entry feeding the news + advisor UI. */
export interface NewsEntry {
  at: number;
  empireId: string | null;
  kind: string;
  message: string;
}

/** The whole game instance. */
export interface GameState {
  config: GameConfig;
  empires: Record<string, EmpireState>;
  /** Insertion-ordered empire ids (turn order / scoreboard stability). */
  order: string[];
  createdAt: number;
  rngState: number;
  treaties: Treaty[];
  log: NewsEntry[];
  /** Regions still claimable from today's shared land pool (BRE/SRE land faucet). */
  landPool: number;
  /** Day index the land pool was last refilled (day = elapsed dayMinutes since start). */
  landDay: number;
  /** The shared planet all empires live on (canonical tile map; see planet.ts). */
  planet: Planet;
}

/** Context passed into every pure mutation: injected time + RNG seed. */
export interface ApplyContext {
  now: number;
  seed: number;
}

function emptyLedger(): ResourceLedger {
  return { gold: 0, food: 0, fuel: 0, ore: 0, steel: 0 };
}

export interface NewEmpireOptions {
  id: string;
  name: string;
  isNpc?: boolean;
  now: number;
  config?: GameConfig;
  /** Presentation-only identity colour (hex). */
  hue?: string;
  /** Starting region counts by type. */
  startRegions?: Partial<Record<RegionKey, number>>;
  startResources?: Partial<ResourceLedger>;
}

/** Build starting regions with deterministic, per-empire ids (no global state). */
function makeRegions(
  empireId: string,
  counts: Partial<Record<RegionKey, number>>,
): OwnedRegion[] {
  const out: OwnedRegion[] = [];
  let seq = 0;
  for (const [type, n] of Object.entries(counts) as [RegionKey, number][]) {
    for (let i = 0; i < n; i++) {
      out.push({ id: `${empireId}-r${seq++}`, type });
    }
  }
  return out;
}

/** A balanced-ish starting allocation for a fresh empire (tunable). */
export const DEFAULT_START_REGIONS: Partial<Record<RegionKey, number>> = {
  agricultural: 4,
  river: 2,
  urban: 3,
  industrial: 2,
  mountain: 2,
  desert: 1,
};

/**
 * Varied starting homelands so empires don't all look/play identically. Each is
 * ~14 regions but with a distinct character; assigned round-robin in createGame.
 */
export const START_PRESETS: ReadonlyArray<Partial<Record<RegionKey, number>>> = [
  DEFAULT_START_REGIONS, // balanced (player)
  { agricultural: 6, river: 3, urban: 2, mountain: 2, desert: 1 }, // agrarian
  { industrial: 4, urban: 4, mountain: 3, agricultural: 2, desert: 1 }, // industrial
  { coastal: 3, river: 2, urban: 3, industrial: 2, agricultural: 2, technology: 1, desert: 1 }, // coastal/tech
  { mountain: 5, desert: 3, urban: 3, agricultural: 2, industrial: 1 }, // frontier
];

/** Create a fresh empire with starting land, resources, and protection. */
export function createEmpire(opts: NewEmpireOptions): EmpireState {
  const config = opts.config ?? DEFAULT_GAME_CONFIG;
  const resources = emptyLedger();
  resources.gold = 2000;
  resources.food = 500;
  resources.fuel = 200;
  Object.assign(resources, opts.startResources ?? {});

  const regions = makeRegions(opts.id, opts.startRegions ?? DEFAULT_START_REGIONS);

  return {
    id: opts.id,
    name: opts.name,
    isNpc: opts.isNpc ?? false,
    resources,
    population: 100,
    popularSupport: 100,
    taxRate: config.taxRateDefault,
    regions,
    militaryStructures: {},
    units: {},
    turns: config.turnsPerDay,
    lastAccrualAt: opts.now,
    protectionTurnsLeft: config.protectionTurns,
    turnsPlayed: 0,
    // Next region id continues after the starting regions → no collisions.
    regionSeq: regions.length,
    netWorth: 0,
    attacksToday: 0,
    attackDay: 0,
    recentHits: {},
    research: 0,
    tech: [],
    hue: opts.hue,
  };
}

export interface NewGameOptions {
  now: number;
  seed?: number;
  config?: GameConfig;
  /** Empire specs (first is conventionally the human player). */
  empires: {
    id: string;
    name: string;
    isNpc?: boolean;
    /** Presentation-only identity colour (hex). */
    hue?: string;
    /** Override starting land (else a START_PRESET is used). */
    startRegions?: Partial<Record<RegionKey, number>>;
    /** Override starting resources (e.g. a larger credit budget for a custom start). */
    startResources?: Partial<ResourceLedger>;
  }[];
}

/** Create a new game with the given empires. */
export function createGame(opts: NewGameOptions): GameState {
  const config = opts.config ?? DEFAULT_GAME_CONFIG;
  const empires: Record<string, EmpireState> = {};
  const order: string[] = [];
  opts.empires.forEach((e, i) => {
    empires[e.id] = createEmpire({
      id: e.id,
      name: e.name,
      isNpc: e.isNpc,
      hue: e.hue,
      now: opts.now,
      config,
      startRegions: e.startRegions ?? START_PRESETS[i % START_PRESETS.length],
      startResources: e.startResources,
    });
    order.push(e.id);
  });

  // Build the shared planet and place every empire at an equidistant home,
  // then bind each starting region to the tile it claimed. Size is config-driven
  // (PLANET_SIZES) but always leaves room for every empire's starting cluster.
  const planetSize = Math.max(config.planetTiles, order.length * 40);
  const planet = makePlanet(planetSize, opts.seed ?? 1);
  const placed = placeEmpires(
    planet,
    order.map((id) => ({ id, types: empires[id].regions.map((r) => r.type) })),
  );
  for (const id of order) {
    const tiles = placed[id];
    empires[id].regions.forEach((r, i) => {
      if (tiles[i] !== undefined) {
        r.tile = tiles[i];
        planet.structure[tiles[i]] = r.structure ?? null;
      }
    });
  }

  return {
    config,
    empires,
    order,
    createdAt: opts.now,
    rngState: opts.seed ?? 1,
    treaties: [],
    log: [],
    // Day 0's shared land pool scales with the number of empires in the game.
    landPool: config.landPerEmpirePerDay * order.length,
    landDay: 0,
    planet,
  };
}
