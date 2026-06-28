import { describe, it, expect } from "vitest";
import {
  createGame,
  apply,
  areAtPeace,
  treatyBetween,
  tradeIncome,
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

describe("treaties", () => {
  it("signs a trade treaty an NPC accepts and pays income", () => {
    const g = game();
    const { state, result } = apply(
      g,
      "p1",
      { kind: "PROPOSE_TREATY", targetEmpireId: "n1", treatyType: "trade" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(treatyBetween(state, "p1", "n1")?.type).toBe("trade");
    expect(tradeIncome(state, "p1", state.config)).toBe(
      state.config.diplomacy.tradeGoldPerPartner,
    );
  });

  it("non-aggression makes the pair at peace and blocks attacks", () => {
    let g = game();
    g = apply(
      g,
      "p1",
      { kind: "PROPOSE_TREATY", targetEmpireId: "n1", treatyType: "nonAggression" },
      ctx,
    ).state;
    expect(areAtPeace(g, "p1", "n1")).toBe(true);

    // give p1 an army & drop protection, then try to attack the ally
    g = {
      ...g,
      empires: {
        ...g.empires,
        p1: { ...g.empires.p1, protectionTurnsLeft: 0, units: { battleTank: 50 } },
        n1: { ...g.empires.n1, protectionTurnsLeft: 0 },
      },
    };
    const { result } = apply(
      g,
      "p1",
      { kind: "ATTACK", targetEmpireId: "n1", force: { battleTank: 50 } },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/treaty/i);
  });

  it("breaking a treaty re-enables hostilities", () => {
    let g = game();
    g = apply(
      g,
      "p1",
      { kind: "PROPOSE_TREATY", targetEmpireId: "n1", treatyType: "alliance" },
      ctx,
    ).state;
    const { state } = apply(
      g,
      "p1",
      { kind: "BREAK_TREATY", targetEmpireId: "n1" },
      ctx,
    );
    expect(areAtPeace(state, "p1", "n1")).toBe(false);
    expect(treatyBetween(state, "p1", "n1")).toBeUndefined();
  });

  it("trade income is added during a turn tick", () => {
    let g = game();
    g = apply(
      g,
      "p1",
      { kind: "PROPOSE_TREATY", targetEmpireId: "n1", treatyType: "trade" },
      ctx,
    ).state;
    const before = g.empires.p1.resources.gold;
    const { state } = apply(g, "p1", { kind: "PLAY_TURN" }, ctx);
    // net gold (225) + trade (40) = 265
    expect(state.empires.p1.resources.gold).toBe(before + 225 + 40);
  });
});
