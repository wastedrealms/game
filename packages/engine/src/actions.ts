import type { CovertOp, RegionKey, Resource, TreatyType } from "./types.js";

/**
 * The action set the reducer understands. The UI/NPC sends an *intent*; the
 * engine validates turns/cost/prereqs and applies it (see apply.ts).
 * Phase 1 covers the economy + build loop; combat/diplomacy land next.
 */
export type Action =
  | { kind: "PLAY_TURN" }
  | {
      kind: "BUY_REGION";
      regionType: RegionKey;
      qty: number;
      /** Claim this specific planet tile (must be neutral). Omitted = auto-pick frontier. */
      tile?: number;
    }
  | { kind: "BUILD_STRUCTURE"; structureKey: string; regionId?: string }
  | { kind: "BUILD_UNIT"; unitKey: string; batches: number }
  | { kind: "RESEARCH"; techKey: string }
  | { kind: "SET_TAX"; rate: number }
  | { kind: "SET_NAME"; name: string }
  | {
      kind: "ATTACK";
      targetEmpireId: string;
      /** unit key → count committed to the attack. */
      force: Record<string, number>;
    }
  | { kind: "PROPOSE_TREATY"; targetEmpireId: string; treatyType: TreatyType }
  | { kind: "BREAK_TREATY"; targetEmpireId: string }
  | { kind: "MARKET"; side: "buy" | "sell"; resource: Resource; qty: number }
  | {
      kind: "COVERT_OP";
      targetEmpireId: string;
      operation: CovertOp;
      agents: number;
    };

export type ActionKind = Action["kind"];

/** Result of applying an action: ok flag + human-readable message + events. */
export interface ActionResult {
  ok: boolean;
  message: string;
}
