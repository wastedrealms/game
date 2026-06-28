import {
  TECHS,
  TECH_BY_KEY,
  canResearch,
  researchPerTurn,
  type Action,
  type GameState,
} from "@wasted-realms/engine";
import { FlaskConical, Check, Lock, Beaker } from "lucide-react";

export function Research({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const e = game.empires[playerId];
  const rp = Math.round(e.research ?? 0);
  const perTurn = researchPerTurn(e, game.config);
  const owned = new Set(e.tech ?? []);

  // The current research target = first milestone not yet owned.
  const next = TECHS.find((t) => !owned.has(t.key));
  const toNext = next ? Math.min(1, rp / next.rpCost) : 1;

  // Show the win objective when this is a tech game.
  const goal = game.config.victory.type === "tech" ? game.config.victory.techGoal : null;

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <FlaskConical className="h-3.5 w-3.5" /> Research
        <span className="ml-auto normal-case tracking-normal">
          <span className="text-[var(--color-accent)] tabular-nums">{rp.toLocaleString()}</span>
          <span className="opacity-50"> RP · </span>
          <span className={perTurn > 0 ? "text-[var(--color-food)]" : "opacity-50"}>
            +{perTurn}/turn
          </span>
        </span>
      </h2>

      {perTurn === 0 && (
        <p className="px-4 pt-3 font-display text-[11px] text-[var(--color-accent)]">
          Build a <span className="font-semibold">Research Facility</span> on a Technology region
          (Build tab) to generate Research Points.
        </p>
      )}

      {/* Progress toward the next milestone */}
      {next && (
        <div className="px-4 pt-3">
          <div className="mb-1 flex items-baseline justify-between font-display text-[11px] opacity-60">
            <span>Next: {next.name}</span>
            <span className="tabular-nums">
              {rp.toLocaleString()} / {next.rpCost.toLocaleString()} RP
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-300/50 dark:bg-[var(--color-edge)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${Math.round(toNext * 100)}%` }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-px p-4">
        {TECHS.map((t) => {
          const isOwned = owned.has(t.key);
          const chk = canResearch(e, t.key);
          const prereqMissing = !!t.requires && !owned.has(t.requires);
          const isGoal = t.key === goal;
          return (
            <li
              key={t.key}
              className={`flex items-start gap-3 rounded-md px-3 py-2 ${
                isOwned
                  ? "bg-[var(--color-accent)]/10"
                  : prereqMissing
                    ? "opacity-50"
                    : "bg-black/5 dark:bg-white/5"
              }`}
            >
              {/* Tier badge */}
              <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded font-display text-[11px] font-bold ${
                  isOwned
                    ? "bg-[var(--color-accent)] text-black"
                    : "border border-stone-300 opacity-70 dark:border-[var(--color-edge)]"
                }`}
              >
                T{t.tier}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-display text-sm">
                  {prereqMissing && <Lock className="h-3 w-3 opacity-50" />}
                  <span className="font-semibold">{t.name}</span>
                  {isGoal && (
                    <span className="rounded bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-accent)]">
                      Victory
                    </span>
                  )}
                </div>
                <p className="font-display text-[11px] leading-snug opacity-55">{t.note}</p>
                {prereqMissing && (
                  <p className="font-display text-[10px] opacity-50">
                    Needs {TECH_BY_KEY.get(t.requires!)?.name ?? t.requires}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="font-display text-[11px] tabular-nums opacity-60">
                  {t.rpCost.toLocaleString()} RP
                </div>
                {isOwned ? (
                  <span className="mt-1 inline-flex items-center gap-1 font-display text-[11px] text-[var(--color-food)]">
                    <Check className="h-3.5 w-3.5" /> Done
                  </span>
                ) : (
                  <button
                    onClick={() => dispatch({ kind: "RESEARCH", techKey: t.key })}
                    disabled={!chk.ok}
                    title={chk.reason}
                    className="mt-1 inline-flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 font-display text-[11px] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 dark:border-[var(--color-edge)]"
                  >
                    <Beaker className="h-3 w-3" /> Research
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
