import {
  economyBreakdown,
  type GameState,
  type Resource,
  type ResourceBag,
} from "@wasted-realms/engine";
import { Scale } from "lucide-react";
import { RES_META, RES_ORDER, fmt } from "../ui/resources";

/**
 * Per-resource income/expense breakdown — the "what will Play Turn do" ledger.
 * Answers: where does each + and − come from, and the net per resource.
 */
export function Ledger({ game, playerId }: { game: GameState; playerId: string }) {
  const e = game.empires[playerId];
  const b = economyBreakdown(e, game.config, game.planet);

  const rows: { label: string; bag: ResourceBag; minus?: boolean }[] = [
    { label: "Regions", bag: b.regionIncome },
    { label: "Structures", bag: b.structureIncome },
    { label: "Synergy", bag: b.synergy },
    { label: "Tax", bag: { gold: b.taxGold } },
    { label: `Morale ×${Math.round(b.supportMult * 100)}%`, bag: b.morale },
    { label: "Upkeep", bag: b.upkeep, minus: true },
    { label: "Food (pop)", bag: { food: b.foodConsumption }, minus: true },
  ];

  return (
    <section className="wr-boot overflow-hidden rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <Scale className="h-3.5 w-3.5" /> Per-Turn Ledger
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full font-display text-sm">
          <thead>
            <tr className="border-b border-stone-200/70 dark:border-[var(--color-edge)]">
              <th className="px-4 py-2 text-left text-[11px] uppercase tracking-wide opacity-40">
                Source
              </th>
              {RES_ORDER.map((r) => {
                const { Icon, cls, label } = RES_META[r];
                return (
                  <th key={r} className="px-3 py-2 text-right" title={label}>
                    <Icon className={`ml-auto h-4 w-4 ${cls}`} strokeWidth={2.25} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-stone-200/50 dark:border-[var(--color-edge)]/60"
              >
                <td className="px-4 py-1.5 opacity-70">{row.label}</td>
                {RES_ORDER.map((r) => (
                  <Cell key={r} v={row.bag[r as Resource] ?? 0} minus={row.minus} />
                ))}
              </tr>
            ))}
            <tr className="bg-stone-100/60 dark:bg-white/[0.03]">
              <td className="px-4 py-2 font-bold uppercase tracking-wide">Net / turn</td>
              {RES_ORDER.map((r) => {
                const v = b.net[r as Resource];
                return (
                  <td
                    key={r}
                    className={`px-3 py-2 text-right font-bold tabular-nums ${
                      v < 0
                        ? "text-red-500"
                        : v > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "opacity-30"
                    }`}
                  >
                    {v > 0 ? "+" : ""}
                    {fmt(v)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ v, minus }: { v: number; minus?: boolean }) {
  if (v === 0) return <td className="px-3 py-1.5 text-right opacity-20">—</td>;
  const shown = minus ? -Math.abs(v) : v;
  return (
    <td
      className={`px-3 py-1.5 text-right tabular-nums ${
        shown < 0 ? "text-red-500/80" : "text-emerald-600/80 dark:text-emerald-400/80"
      }`}
    >
      {shown > 0 ? "+" : ""}
      {fmt(shown)}
    </td>
  );
}
