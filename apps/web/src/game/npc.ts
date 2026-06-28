// NPC behaviour now lives in the pure engine (testable + reusable server-side).
// Kept here as a re-export so existing imports (useGame) keep working.
export { stepNpcs } from "@wasted-realms/engine";
