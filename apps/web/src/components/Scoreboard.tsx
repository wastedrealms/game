import type { GameState } from "@wasted-realms/engine";
import { Bot, Crown, Trophy } from "lucide-react";
import { fmt } from "../ui/resources";
import { empireHueMap } from "../ui/empireColors";

export function Scoreboard({
  game,
  playerId,
}: {
  game: GameState;
  playerId: string;
}) {
  const ranked = [...game.order].sort(
    (a, b) => game.empires[b].netWorth - game.empires[a].netWorth,
  );
  const colorById = empireHueMap(game);
  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 p-4 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest opacity-70">
        <Trophy className="h-3.5 w-3.5" /> Scoreboard
      </h2>
      <ol className="space-y-1.5">
        {ranked.map((id, i) => {
          const e = game.empires[id];
          const you = id === playerId;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5"
              // Player row tinted in our own hue (≈10% alpha via the "1a" suffix).
              style={you ? { backgroundColor: `${colorById[id]}1a` } : undefined}
            >
              <span className="w-5 font-display text-sm tabular-nums opacity-50">
                {i + 1}
              </span>
              {/* Icon coloured to the empire's hue — robot for NPCs, crown for you. */}
              {e.isNpc ? (
                <Bot className="h-4 w-4" style={{ color: colorById[id] }} />
              ) : (
                <Crown className="h-4 w-4" style={{ color: colorById[id] }} />
              )}
              <span
                className={`flex-1 font-display text-sm ${you ? "font-bold" : ""}`}
              >
                {e.name}
              </span>
              <span className="font-display text-sm tabular-nums opacity-70">
                {fmt(e.netWorth)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
