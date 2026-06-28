import { describe, it, expect } from "vitest";
import {
  createGame,
  apply,
  canResearch,
  researchPerTurn,
  structureProduction,
  checkVictory,
  victoryPreset,
  DEFAULT_GAME_CONFIG,
  type GameState,
  type ApplyContext,
} from "../src/index.js";

const ctx: ApplyContext = { now: 0, seed: 1 };

function game(): GameState {
  return createGame({
    now: 0,
    seed: 1,
    empires: [
      { id: "p1", name: "Player" },
      { id: "n1", name: "Nemesis", isNpc: true },
    ],
  });
}

/** Replace p1 with the given overrides. */
function withP1(g: GameState, over: Partial<GameState["empires"]["p1"]>): GameState {
  return { ...g, empires: { ...g.empires, p1: { ...g.empires.p1, ...over } } };
}

describe("research points", () => {
  it("accrue from research facilities each turn", () => {
    const g = withP1(game(), {
      regions: [{ id: "t", type: "technology", structure: "researchFacility" }],
    });
    expect(researchPerTurn(g.empires.p1, g.config)).toBe(
      DEFAULT_GAME_CONFIG.economy.researchPerFacility,
    );
    const out = apply(g, "p1", { kind: "PLAY_TURN" }, ctx);
    expect(out.state.empires.p1.research).toBe(
      DEFAULT_GAME_CONFIG.economy.researchPerFacility,
    );
  });
});

describe("canResearch + RESEARCH", () => {
  it("enforces prereq + RP cost, then spends and unlocks", () => {
    const g = withP1(game(), { research: 250 });
    // T1 affordable; T2 blocked (prereq not owned).
    expect(canResearch(g.empires.p1, "industrialLogistics").ok).toBe(true);
    expect(canResearch(g.empires.p1, "advancedMaterials").ok).toBe(false);

    const out = apply(g, "p1", { kind: "RESEARCH", techKey: "industrialLogistics" }, ctx);
    expect(out.result.ok).toBe(true);
    expect(out.state.empires.p1.tech).toContain("industrialLogistics");
    expect(out.state.empires.p1.research).toBe(50); // 250 − 200

    // Prereq now met, but not enough RP for T2 (needs 500).
    const t2 = canResearch(out.state.empires.p1, "advancedMaterials");
    expect(t2.ok).toBe(false);
    expect(t2.reason).toMatch(/research points/i);
  });

  it("rejects re-researching an owned milestone", () => {
    const g = withP1(game(), { research: 1000, tech: ["industrialLogistics"] });
    const out = apply(g, "p1", { kind: "RESEARCH", techKey: "industrialLogistics" }, ctx);
    expect(out.result.ok).toBe(false);
  });
});

describe("Tier-I unlock effects", () => {
  it("Advanced Materials raises Ore/Steel structure yield", () => {
    const base = withP1(game(), {
      regions: [{ id: "m", type: "mountain", structure: "ironOreMine" }],
    }).empires.p1;
    const plain = structureProduction(base);
    const teched = structureProduction({
      ...base,
      tech: ["industrialLogistics", "advancedMaterials"],
    });
    expect(teched.ore ?? 0).toBeGreaterThan(plain.ore ?? 0);
  });
});

describe("tech victory", () => {
  it("fires when an empire reaches the goal milestone", () => {
    const g = game();
    const cfg = { ...g.config, victory: victoryPreset("tech", "short") }; // goal: orbitalEngineering
    const s = {
      ...g,
      config: cfg,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          tech: ["industrialLogistics", "advancedMaterials", "orbitalEngineering"],
        },
      },
    };
    const v = checkVictory(s);
    expect(v.over).toBe(true);
    expect(v.winnerId).toBe("p1");
  });
});
