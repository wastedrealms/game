import {
  treatyBetween,
  type Action,
  type GameState,
  type TreatyType,
} from "@wasted-realms/engine";
import { Handshake, Bot, Crown, Scroll, X } from "lucide-react";
import { fmt } from "../ui/resources";
import { empireHueMap } from "../ui/empireColors";

const TREATY_LABEL: Record<TreatyType, string> = {
  trade: "Trade",
  nonAggression: "Non-Aggression",
  alliance: "Alliance",
};

export function Diplomacy({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const others = game.order.filter((id) => id !== playerId);
  const colorById = empireHueMap(game);

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <Handshake className="h-3.5 w-3.5" /> Diplomacy
      </h2>

      <ul className="divide-y divide-stone-200/70 dark:divide-[var(--color-edge)]">
        {others.map((id) => {
          const e = game.empires[id];
          const treaty = treatyBetween(game, playerId, id);
          return (
            <li key={id} className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                {e.isNpc ? (
                  <Bot className="h-4 w-4" style={{ color: colorById[id] }} />
                ) : (
                  <Crown className="h-4 w-4" style={{ color: colorById[id] }} />
                )}
                <span className="font-display text-sm font-medium">{e.name}</span>
                <span className="font-display text-xs opacity-40">
                  net worth {fmt(e.netWorth)}
                </span>
                {treaty && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 font-display text-xs text-emerald-600 dark:text-emerald-400">
                    <Scroll className="h-3 w-3" /> {TREATY_LABEL[treaty.type]}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["trade", "nonAggression", "alliance"] as TreatyType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      dispatch({ kind: "PROPOSE_TREATY", targetEmpireId: id, treatyType: t })
                    }
                    disabled={treaty?.type === t}
                    className="rounded-md border border-stone-300 px-2.5 py-1 font-display text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 dark:border-[var(--color-edge)]"
                  >
                    Propose {TREATY_LABEL[t]}
                  </button>
                ))}
                {treaty && (
                  <button
                    onClick={() => dispatch({ kind: "BREAK_TREATY", targetEmpireId: id })}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2.5 py-1 font-display text-xs text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    <X className="h-3 w-3" /> Break
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="px-4 py-2 font-display text-[11px] opacity-40">
        Trade treaties add credits each turn. Non-aggression & alliances prevent war
        between signatories.
      </p>
    </section>
  );
}
