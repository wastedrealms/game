import { useMemo, useState } from "react";
import type { GameState } from "@wasted-realms/engine";
import { Radio, Swords, Coins, Handshake, Eye, Megaphone, type LucideIcon } from "lucide-react";

/** Visual metadata per log `kind` emitted by the engine (see apply.ts pushLog). */
const KIND_META: Record<string, { label: string; Icon: LucideIcon; cls: string }> = {
  combat: { label: "Battles", Icon: Swords, cls: "text-red-400" },
  turn: { label: "Economy", Icon: Coins, cls: "text-[var(--color-gold)]" },
  diplomacy: { label: "Diplomacy", Icon: Handshake, cls: "text-[var(--color-fuel)]" },
  covert: { label: "Covert", Icon: Eye, cls: "text-violet-400" },
};
const FALLBACK = { label: "News", Icon: Megaphone, cls: "opacity-60" };
const meta = (kind: string) => KIND_META[kind] ?? FALLBACK;

// Order of the filter chips. "all" first.
const FILTERS = ["all", "combat", "turn", "diplomacy", "covert"] as const;
type Filter = (typeof FILTERS)[number];

export function NewsLog({ game }: { game: GameState }) {
  const [filter, setFilter] = useState<Filter>("all");

  // Counts per kind (over the whole log) drive the chip badges.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of game.log) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, [game.log]);

  const entries = useMemo(() => {
    const filtered = filter === "all" ? game.log : game.log.filter((n) => n.kind === filter);
    return filtered.slice(-30).reverse();
  }, [game.log, filter]);

  return (
    <section className="wr-boot flex min-h-0 flex-1 flex-col rounded-lg border border-stone-200 bg-white/60 p-4 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="mb-2.5 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest opacity-70">
        <Radio className="h-3.5 w-3.5" /> News Feed
      </h2>

      {/* Category filters */}
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => {
          const active = filter === f;
          const m = f === "all" ? null : meta(f);
          const n = f === "all" ? game.log.length : counts[f] ?? 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 font-display text-[10px] uppercase tracking-wide transition-colors ${
                active
                  ? "bg-[var(--color-accent)] text-black"
                  : "border border-stone-300 opacity-70 hover:opacity-100 dark:border-[var(--color-edge)]"
              }`}
            >
              {m && <m.Icon className="h-3 w-3" />}
              {f === "all" ? "All" : m!.label}
              <span className={active ? "opacity-70" : "opacity-50"}>{n}</span>
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <p className="font-display text-sm opacity-40">
          {filter === "all"
            ? "Quiet on the wire. Play a turn to advance the realm."
            : `No ${meta(filter).label.toLowerCase()} news yet.`}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {entries.map((n, i) => {
            const m = meta(n.kind);
            return (
              <li key={i} className="flex gap-1.5 font-display text-xs leading-relaxed">
                <m.Icon className={`mt-0.5 h-3 w-3 shrink-0 ${m.cls}`} />
                <span className="opacity-80">{n.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
