import { useState } from "react";
import type { Action, GameState, Resource } from "@wasted-realms/engine";
import { Store } from "lucide-react";
import { RES_META, fmt } from "../ui/resources";

const TRADABLE: Resource[] = ["food", "fuel", "ore", "steel"];

export function Market({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const e = game.empires[playerId];
  const { prices, buySpread } = game.config.market;
  const [qty, setQty] = useState<Record<string, number>>({});

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <Store className="h-3.5 w-3.5" /> Market
        <span className="ml-auto inline-flex items-center gap-1 normal-case">
          <RES_META.gold.Icon className="h-3.5 w-3.5 text-[var(--color-gold)]" />
          {fmt(e.resources.gold)}
        </span>
      </h2>

      <ul className="divide-y divide-stone-200/70 dark:divide-[var(--color-edge)]">
        {TRADABLE.map((r) => {
          const { Icon, cls, label } = RES_META[r];
          const sell = prices[r];
          const buy = Math.ceil(sell * buySpread);
          const amount = qty[r] || 10;
          const owned = e.resources[r];
          return (
            <li key={r} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="inline-flex w-28 items-center gap-1.5 font-display text-sm">
                <Icon className={`h-4 w-4 ${cls}`} strokeWidth={2.25} />
                {label}
                <span className="opacity-40">({fmt(owned)})</span>
              </span>
              <span className="font-display text-xs opacity-60">
                sell {sell} · buy {buy}
              </span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(ev) =>
                  setQty((q) => ({ ...q, [r]: Math.max(1, Number(ev.target.value)) }))
                }
                className="w-20 rounded border border-stone-300 bg-transparent px-2 py-1 text-right font-display text-sm tabular-nums dark:border-[var(--color-edge)]"
              />
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={() =>
                    dispatch({ kind: "MARKET", side: "sell", resource: r, qty: amount })
                  }
                  disabled={owned < amount}
                  className="rounded-md border border-stone-300 px-2.5 py-1 font-display text-xs transition-colors hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-30 dark:border-[var(--color-edge)]"
                >
                  Sell +{fmt(sell * amount)}
                </button>
                <button
                  onClick={() =>
                    dispatch({ kind: "MARKET", side: "buy", resource: r, qty: amount })
                  }
                  disabled={e.resources.gold < buy * amount}
                  className="rounded-md border border-stone-300 px-2.5 py-1 font-display text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 dark:border-[var(--color-edge)]"
                >
                  Buy −{fmt(buy * amount)}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="px-4 py-2 font-display text-[11px] opacity-40">
        Sell surplus Ore/Steel/Food/Fuel for credits, or buy what you're short on. Trading
        costs no turns.
      </p>
    </section>
  );
}
