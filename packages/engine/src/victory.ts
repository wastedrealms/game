import type { GameLength, VictoryConfig, VictoryType } from "./types.js";
import type { GameState, EmpireState } from "./state.js";
import { TECHS } from "./data/tech.js";
import { TECH_BY_KEY } from "./lookups.js";

/**
 * Victory conditions. Deliberately NOT quick — the length presets target real
 * hours of active play, so a game spans many in-game
 * days. The net-worth scoreboard is always live; victory is the match-end layer.
 *
 * Turn budgets (≈120 turns ≈ 1 hour of active play):
 *   short  ≈ 2–3 h   medium ≈ 5–7 h   long ≈ 10–14 h
 */
const LENGTH_PRESETS: Record<
  GameLength,
  { turnDeadline: number; dominationPct: number; netWorthTarget: number; techGoal: string }
> = {
  short: { turnDeadline: 300, dominationPct: 0.6, netWorthTarget: 1500, techGoal: "orbitalEngineering" },
  medium: { turnDeadline: 700, dominationPct: 0.7, netWorthTarget: 4000, techGoal: "terraforming" },
  long: { turnDeadline: 1400, dominationPct: 0.8, netWorthTarget: 10000, techGoal: "singularity" },
};

/** Tech keys on the ladder up to & including the goal (the path to a tech win). */
function techPath(goalKey: string): string[] {
  const goal = TECH_BY_KEY.get(goalKey);
  const maxTier = goal?.tier ?? Infinity;
  return TECHS.filter((t) => t.tier <= maxTier).map((t) => t.key);
}

/** Build a victory config from a type + length preset. */
export function victoryPreset(type: VictoryType, length: GameLength): VictoryConfig {
  return { type, length, ...LENGTH_PRESETS[length] };
}

/** Human-readable one-liner describing the active objective. */
export function victoryObjective(cfg: VictoryConfig): string {
  switch (cfg.type) {
    case "domination":
      return `Control ${Math.round(cfg.dominationPct * 100)}% of all claimed land`;
    case "economic":
      return `Reach a net worth of ${cfg.netWorthTarget.toLocaleString()}`;
    case "score":
      return `Hold the highest net worth at turn ${cfg.turnDeadline.toLocaleString()}`;
    case "tech":
      return `Research ${TECH_BY_KEY.get(cfg.techGoal)?.name ?? cfg.techGoal}`;
  }
}

export interface VictoryStatus {
  over: boolean;
  /** Winner once the game is over. */
  winnerId?: string;
  /** Why it ended (for the banner). */
  reason?: string;
  /** Current front-runner (for the live objective display). */
  leaderId: string;
  /** Leader's progress toward the active win condition, 0..1. */
  progress: number;
  /** Current game turn (max turns played across empires). */
  gameTurn: number;
  /** Game-turn deadline. */
  turnDeadline: number;
}

/**
 * Evaluate the game's victory state. Pure — derived entirely from `state`, so the
 * UI can call it any time and the server can authoritatively end matches.
 */
export function checkVictory(state: GameState): VictoryStatus {
  const cfg = state.config.victory;
  const ids = state.order;
  const empires = ids.map((id) => state.empires[id]);

  const gameTurn = Math.max(0, ...empires.map((e) => e.turnsPlayed));
  const totalLand = Math.max(1, empires.reduce((s, e) => s + e.regions.length, 0));

  // Current net-worth leader (drives the live objective + score/deadline win).
  const leader = empires.reduce((a, b) => (b.netWorth > a.netWorth ? b : a));

  // Last empire standing always wins by conquest, regardless of victory type.
  const alive = empires.filter((e) => e.regions.length > 0);
  if (alive.length === 1 && empires.length > 1) {
    return done(alive[0].id, `${alive[0].name} is the last realm standing`, gameTurn, cfg);
  }

  // Hard deadline: highest net worth wins ("score" reaches this; others time out).
  if (gameTurn >= cfg.turnDeadline) {
    return done(
      leader.id,
      `Turn ${cfg.turnDeadline} reached — ${leader.name} holds the highest net worth`,
      gameTurn,
      cfg,
    );
  }

  if (cfg.type === "domination") {
    const champ = empires.find((e) => e.regions.length / totalLand >= cfg.dominationPct);
    if (champ) {
      const pct = Math.round((champ.regions.length / totalLand) * 100);
      return done(champ.id, `${champ.name} controls ${pct}% of the planet`, gameTurn, cfg);
    }
  }

  if (cfg.type === "economic") {
    const champ = empires.find((e) => e.netWorth >= cfg.netWorthTarget);
    if (champ) {
      return done(
        champ.id,
        `${champ.name} reached a net worth of ${champ.netWorth.toLocaleString()}`,
        gameTurn,
        cfg,
      );
    }
  }

  if (cfg.type === "tech") {
    const champ = empires.find((e) => (e.tech ?? []).includes(cfg.techGoal));
    if (champ) {
      const name = TECH_BY_KEY.get(cfg.techGoal)?.name ?? cfg.techGoal;
      return done(champ.id, `${champ.name} achieved ${name}`, gameTurn, cfg);
    }
  }

  // Not over — report the leader's progress toward the active condition. For a
  // tech game the front-runner is the furthest up the ladder, not the richest.
  let progress: number;
  let leaderId = leader.id;
  if (cfg.type === "domination") {
    progress = leader.regions.length / totalLand / cfg.dominationPct;
  } else if (cfg.type === "economic") {
    progress = leader.netWorth / cfg.netWorthTarget;
  } else if (cfg.type === "tech") {
    const path = techPath(cfg.techGoal);
    const owned = (e: EmpireState) => path.filter((k) => (e.tech ?? []).includes(k)).length;
    const techLeader = empires.reduce((a, b) => (owned(b) > owned(a) ? b : a));
    leaderId = techLeader.id;
    progress = path.length ? owned(techLeader) / path.length : 0;
  } else {
    progress = gameTurn / cfg.turnDeadline;
  }

  return {
    over: false,
    leaderId,
    progress: clamp01(progress),
    gameTurn,
    turnDeadline: cfg.turnDeadline,
  };
}

function done(
  winnerId: string,
  reason: string,
  gameTurn: number,
  cfg: VictoryConfig,
): VictoryStatus {
  return {
    over: true,
    winnerId,
    reason,
    leaderId: winnerId,
    progress: 1,
    gameTurn,
    turnDeadline: cfg.turnDeadline,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
