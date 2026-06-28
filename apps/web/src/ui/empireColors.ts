import { makeRng, type GameState, type RegionKey } from "@wasted-realms/engine";

/**
 * Per-empire colour scheme. Each empire has one identity hue; a region's colour is
 * that hue shifted by a fixed per-terrain offset — so URBAN reads as the empire's
 * base colour and every other land type is a recognisable shade in the same family.
 * Used identically by the 3D planet and the 2D map so empires look the same in both.
 */

// The player's identity colour (the amber accent) + 7 distinct rival hues = 8.
export const PLAYER_HUE = "#ffb000";
export const RIVAL_HUES = [
  // yellow (#e8d24a) replaces the old gold (#e0a23a), which was a near-duplicate
  // of the player's amber (#ffb000) — both sat at ~40° hue and looked like twins.
  "#e0564c", "#4c8fe0", "#9b59e0", "#39b58c", "#e8d24a", "#d94c8f", "#5ad0e0",
];
/** The full pickable palette (8 colours). */
export const ALL_HUES = [PLAYER_HUE, ...RIVAL_HUES];

/**
 * Faction name themed to each palette hue, so an NPC's name always matches its
 * colour (no more "Golden Horde" showing up red). Because the player's chosen hue
 * is removed from the NPC pool, its matching name is excluded automatically.
 */
export const HUE_NAMES: Record<string, string> = {
  "#ffb000": "Golden Horde", //   amber / gold
  "#e0564c": "Crimson Pact", //   red
  "#4c8fe0": "Azure Combine", //  blue
  "#9b59e0": "Violet Covenant", //purple
  "#39b58c": "Verdant League", //  teal-green
  "#e8d24a": "Saffron Concord", // yellow
  "#d94c8f": "Rose Directorate", //pink
  "#5ad0e0": "Aqua Syndicate", //  cyan
};

/** Themed faction name for a given hue (falls back for off-palette hues). */
export function npcNameForHue(hue: string, fallbackIndex = 0): string {
  return HUE_NAMES[hue] ?? `Rival ${fallbackIndex + 1}`;
}

/**
 * Hues for the NPCs: the palette minus the player's pick, SHUFFLED by the game seed —
 * so playing N opponents again gives different rival colours each game, but a given
 * game's colours are stable (deterministic from its seed).
 */
export function assignNpcHues(playerHue: string, count: number, seed: number): string[] {
  const pool = ALL_HUES.filter((h) => h !== playerHue);
  const rng = makeRng(seed >>> 0);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

/** Unclaimed wilderness — near-black, shared by both map views. */
export const UNCLAIMED_HEX = "#0a0e14";
/** Visible neutral grey for legend swatches (the tiles render near-black). */
export const NEUTRAL_HEX = "#3a4452";

/**
 * Whether the player has orbital reconnaissance — i.e. has launched a Recon
 * Satellite (cheap, research-path) or a Defense Satellite (which doubles as recon).
 * Until then, rival territory shows only each empire's base (Urban) colour with its
 * region types and structures hidden ("fog of war").
 */
export function canReconEnemies(game: GameState, playerId: string): boolean {
  const ms = game.empires[playerId]?.militaryStructures;
  return ((ms?.reconSatellite ?? 0) > 0) || ((ms?.defenseSatellite ?? 0) > 0);
}

/** Map empire id → identity hue. Uses each empire's stored `hue` (chosen at setup),
 *  falling back to a stable default for older saves that predate hue selection. */
export function empireHueMap(game: GameState): Record<string, string> {
  const map: Record<string, string> = {};
  game.order.forEach((id, i) => {
    const e = game.empires[id];
    map[id] = e.hue ?? (e.isNpc ? RIVAL_HUES[i % RIVAL_HUES.length] : PLAYER_HUE);
  });
  return map;
}

// Per-terrain offset from the empire's base: URBAN is the base; the others are
// spread across BOTH hue and lightness (and a little saturation) so all 8 land
// types are clearly distinguishable while still reading as the empire's family.
const REGION_OFFSET: Record<RegionKey, { dh: number; dl: number; ds: number }> = {
  urban: { dh: 0, dl: 0.0, ds: 0.0 },
  mountain: { dh: -8, dl: -0.065, ds: -0.025 },
  industrial: { dh: 9, dl: -0.12, ds: 0.025 },
  technology: { dh: -20, dl: 0.02, ds: -0.025 },
  river: { dh: 8, dl: 0.06, ds: 0.04 },
  coastal: { dh: -15, dl: 0.13, ds: 0.0 },
  agricultural: { dh: 19, dl: 0.1, ds: -0.025 },
  desert: { dh: 26, dl: 0.16, ds: -0.06 },
};

/** The colour for a `terrain` region owned by an empire whose base hue is `baseHex`. */
export function empireTileColor(baseHex: string, terrain: RegionKey): string {
  const [h, s, l] = hexToHsl(baseHex);
  const o = REGION_OFFSET[terrain] ?? { dh: 0, dl: 0, ds: 0 };
  return hslToHex((h + o.dh + 360) % 360, clamp(s + o.ds, 0.4, 1), clamp(l + o.dl, 0.22, 0.82));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
