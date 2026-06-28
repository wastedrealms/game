/**
 * @wasted-realms/engine — public API.
 *
 * Phase 0: types + seeded static reference data + pure economy helpers.
 * Phase 1: deterministic state + `apply(state, action, ctx)` reducer + economy tick.
 */

export * from "./types.js";
export * from "./economy.js";
export * from "./rng.js";
export * from "./geo.js";
export * from "./state.js";
export * from "./actions.js";
export * from "./rules.js";
export * from "./combat.js";
export * from "./diplomacy.js";
export * from "./covert.js";
export * from "./apply.js";
export * from "./lookups.js";
export * from "./npc.js";
export * from "./victory.js";
export * from "./planet.js";

export { REGIONS } from "./data/regions.js";
export { STRUCTURES } from "./data/structures.js";
export { UNITS } from "./data/units.js";
export { TECHS } from "./data/tech.js";
export { DEFAULT_GAME_CONFIG } from "./data/gameConfig.js";
