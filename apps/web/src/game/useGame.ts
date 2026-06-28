import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apply,
  createGame,
  checkVictory,
  victoryPreset,
  PLANET_SIZES,
  DEFAULT_GAME_CONFIG,
  type Action,
  type GameState,
  type PlanetSize,
  type VictoryType,
  type GameLength,
} from "@wasted-realms/engine";
import { stepNpcs } from "./npc";
import { PLAYER_HUE, assignNpcHues, npcNameForHue } from "../ui/empireColors";

/** Options chosen on the new-game setup screen. */
export interface SetupOptions {
  /** Player's realm name (blank → "Your Realm"). */
  empireName: string;
  /** Player's chosen identity colour (hex). NPCs take the rest of the palette. */
  empireHue: string;
  /** Number of NPC opponents (1–7; total empires ≤ 8). */
  npcs: number;
  planetSize: PlanetSize;
  winType: VictoryType;
  gameLength: GameLength;
  /** "preset" = tutorial starting territory; "custom" = tiny start + a credit budget. */
  startMode: "preset" | "custom";
}

export const DEFAULT_SETUP: SetupOptions = {
  empireName: "",
  empireHue: PLAYER_HUE,
  npcs: 2,
  planetSize: "medium",
  winType: "score",
  gameLength: "medium",
  startMode: "preset",
};

// Bumped to v7: turns are now unlimited and days are turn-based (dropped the
// per-empire `turns`/`lastAccrualAt` fields; land/attack days key off turnsPlayed).
// Earlier: supportIncomeFloor, shared `planet`, regionSeq, landPool/landDay, victory.
// Old-shape saves are rejected/superseded by load().
const SAVE_KEY = "wr-save-v7";
export const PLAYER_ID = "p1";

// Single-player protection covers the first two full days (16 turns) so a new
// player can learn and build before anyone — player or NPC — can be attacked.
const SP_CONFIG = { ...DEFAULT_GAME_CONFIG, protectionTurns: 16 };

function fresh(now: number): GameState {
  return createGame({
    now,
    seed: 0x5eed,
    config: SP_CONFIG,
    empires: [
      { id: PLAYER_ID, name: "Your Realm", hue: PLAYER_HUE },
      { id: "n1", name: "Crimson Pact", isNpc: true, hue: "#e0564c" }, // red
      { id: "n2", name: "Azure Combine", isNpc: true, hue: "#4c8fe0" }, // blue
    ],
  });
}

/** Build a game from setup-screen options. */
function buildGame(now: number, setup: SetupOptions): GameState {
  const config = {
    ...DEFAULT_GAME_CONFIG,
    protectionTurns: 16,
    planetTiles: PLANET_SIZES[setup.planetSize],
    victory: victoryPreset(setup.winType, setup.gameLength),
  };
  const seed = 0x5eed + setup.npcs * 7 + PLANET_SIZES[setup.planetSize];
  const realmName = setup.empireName.trim() || "Your Realm";
  // Player keeps their chosen hue; rivals take the rest of the palette, shuffled by seed.
  const npcHues = assignNpcHues(setup.empireHue, setup.npcs, seed);
  const player =
    setup.startMode === "custom"
      ? {
          id: PLAYER_ID,
          name: realmName,
          hue: setup.empireHue,
          startRegions: { urban: 1, agricultural: 1, river: 1 },
          startResources: { gold: 6000 },
        }
      : { id: PLAYER_ID, name: realmName, hue: setup.empireHue };
  const empires = [player];
  for (let i = 0; i < setup.npcs; i++) {
    empires.push({
      id: `n${i + 1}`,
      // Name themed to the hue → the name always matches the colour on the map.
      name: npcNameForHue(npcHues[i], i),
      isNpc: true,
      hue: npcHues[i],
    } as typeof player);
  }
  return createGame({ now, seed, config, empires });
}

function load(): GameState | null {
  try {
    // Prune saves from older schema versions so they don't accumulate in storage.
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("wr-save-") && k !== SAVE_KEY) localStorage.removeItem(k);
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const g = JSON.parse(raw) as GameState;
      // Reject saves from an older state shape rather than crashing the app.
      if (
        g?.config?.victory &&
        g.landPool !== undefined &&
        g.empires &&
        g.planet &&
        g.config.combat?.maxAttacksPerDay !== undefined &&
        g.config.victory.techGoal !== undefined &&
        g.config.economy?.researchPerFacility !== undefined
      )
        // Refresh global balance tunables from the latest defaults so in-progress
        // saves pick up balance edits (tax, research, combat, covert, market). The
        // per-game choices — victory, planet size, protection, timing — are kept.
        return {
          ...g,
          config: {
            ...g.config,
            economy: DEFAULT_GAME_CONFIG.economy,
            combat: { ...DEFAULT_GAME_CONFIG.combat },
            covert: { ...DEFAULT_GAME_CONFIG.covert },
            market: { ...DEFAULT_GAME_CONFIG.market },
            diplomacy: { ...DEFAULT_GAME_CONFIG.diplomacy },
          },
        };
    }
  } catch {
    /* ignore corrupt save */
  }
  // No valid save → no game yet; the app shows the landing page until one is created.
  return null;
}

/** React binding around the pure engine: holds the game, persists it, dispatches intents. */
export function useGame() {
  const [game, setGame] = useState<GameState | null>(() => load());
  const [message, setMessage] = useState<string>("Welcome, ruler.");

  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    } catch {
      /* ignore quota */
    }
  }, [game]);

  const dispatch = useCallback(
    (action: Action) => {
      if (!game) return;
      const now = Date.now();
      const out = apply(game, PLAYER_ID, action, { now, seed: game.rngState });
      setMessage(out.result.message);
      let next = out.state;
      // The player playing a turn advances the world clock one step for NPCs.
      if (action.kind === "PLAY_TURN" && out.result.ok) {
        next = stepNpcs(next, { now, seed: next.rngState });
      }
      setGame(next);
    },
    [game],
  );

  const reset = useCallback(() => {
    const g = fresh(Date.now());
    setGame(g);
    setMessage("A new realm rises from the waste.");
  }, []);

  const newGame = useCallback((setup: SetupOptions) => {
    setGame(buildGame(Date.now(), setup));
    setMessage("A new realm rises from the waste.");
  }, []);

  // End the current game: discard the save and return to the landing page.
  const endGame = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    setGame(null);
    setMessage("Welcome, ruler.");
  }, []);

  // Live victory/objective status derived from the pure engine (null until a game exists).
  const victory = useMemo(() => (game ? checkVictory(game) : null), [game]);

  return { game, dispatch, reset, newGame, endGame, message, playerId: PLAYER_ID, victory };
}
