import { useState } from "react";
import {
  UNITS,
  UNIT_BY_KEY,
  offensivePower,
  defensivePower,
  type Action,
  type GameState,
} from "@wasted-realms/engine";
import { Swords, Shield, Bot, Crown, ChevronsUp } from "lucide-react";
import { unitIcon } from "../ui/itemIcons";
import { fmt } from "../ui/resources";

export function War({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const me = game.empires[playerId];
  const [target, setTarget] = useState<string | null>(null);
  const [force, setForce] = useState<Record<string, number>>({});

  const cap = game.config.combat.maxAttacksPerDay;
  const attacksLeft = Math.max(0, cap - (me.attacksToday ?? 0));

  const offensiveUnits = UNITS.filter(
    (u) => (u.attack ?? 0) > 0 && (me.units[u.key] ?? 0) > 0,
  );
  const targets = game.order.filter((id) => id !== playerId);

  const committed: Record<string, number> = {};
  for (const u of offensiveUnits) {
    const owned = me.units[u.key] ?? 0;
    committed[u.key] = Math.min(owned, force[u.key] ?? owned);
  }
  const atkPower = offensivePower(committed);
  const defPower = target ? defensivePower(game.empires[target]) : 0;
  const tgt = target ? game.empires[target] : null;

  const blocked =
    me.protectionTurnsLeft > 0
      ? "You're under protection — you cannot attack yet."
      : attacksLeft <= 0
        ? `Out of attacks today (${cap}/day).`
        : me.turns < 1
        ? "No turns remaining."
        : offensiveUnits.length === 0
          ? "Build offensive units (Barracks → infantry, or Shipyard armour/air) to wage war."
          : !tgt
            ? "Select a target."
            : tgt.protectionTurnsLeft > 0
              ? `${tgt.name} is under protection.`
              : atkPower <= 0
                ? "Commit at least one unit."
                : null;

  const verdict =
    defPower === 0
      ? "Undefended"
      : atkPower >= defPower * 1.2
        ? "Favorable"
        : atkPower >= defPower * 0.9
          ? "Even"
          : "Unfavorable";

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <Swords className="h-3.5 w-3.5" /> War Room
        <span className="ml-auto normal-case tracking-normal">
          <span className={attacksLeft <= 0 ? "text-red-500" : "text-[var(--color-accent)]"}>
            {attacksLeft}
          </span>
          <span className="opacity-50">/{cap} attacks left today</span>
        </span>
      </h2>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {/* Targets */}
        <div>
          <h3 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Target
          </h3>
          <ul className="space-y-1.5">
            {targets.map((id) => {
              const e = game.empires[id];
              const on = target === id;
              const prot = e.protectionTurnsLeft > 0;
              return (
                <li key={id}>
                  <button
                    onClick={() => setTarget(id)}
                    disabled={prot}
                    className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left font-display text-sm transition-colors disabled:opacity-40 ${
                      on
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-stone-300 hover:border-[var(--color-accent)] dark:border-[var(--color-edge)]"
                    }`}
                  >
                    {e.isNpc ? (
                      <Bot className="h-4 w-4 opacity-60" />
                    ) : (
                      <Crown className="h-4 w-4 text-[var(--color-accent)]" />
                    )}
                    <span className="flex-1">{e.name}</span>
                    {(me.recentHits?.[id]?.heat ?? 0) > 0 && (
                      <span
                        className="text-[10px] uppercase text-amber-500"
                        title="Recently raided — captured land is reduced"
                      >
                        raided
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs opacity-60">
                      <Shield className="h-3 w-3" />
                      {fmt(defensivePower(e))}
                    </span>
                    {prot && (
                      <span className="text-[10px] uppercase text-[var(--color-accent)]">
                        🛡
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Force selection */}
        <div>
          <h3 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Commit forces
          </h3>
          {offensiveUnits.length === 0 ? (
            <p className="font-display text-sm opacity-40">No offensive units yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {offensiveUnits.map((u) => {
                const owned = me.units[u.key] ?? 0;
                const val = force[u.key] ?? owned;
                const Icon = unitIcon(u.key);
                return (
                  <li
                    key={u.key}
                    className="flex items-center gap-2 font-display text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="flex-1">
                      {u.name}{" "}
                      <span className="opacity-40">
                        (atk {u.attack}, have {owned})
                      </span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={owned}
                      value={val}
                      onChange={(ev) =>
                        setForce((f) => ({
                          ...f,
                          [u.key]: Math.max(
                            0,
                            Math.min(owned, Number(ev.target.value)),
                          ),
                        }))
                      }
                      className="w-20 rounded border border-stone-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-[var(--color-edge)]"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Odds + attack */}
      <div className="flex flex-wrap items-center gap-4 border-t border-stone-200 px-4 py-3 dark:border-[var(--color-edge)]">
        <div className="font-display text-sm">
          <span className="inline-flex items-center gap-1 text-[var(--color-accent)]">
            <Swords className="h-3.5 w-3.5" /> {fmt(atkPower)}
          </span>{" "}
          <span className="opacity-40">vs</span>{" "}
          <span className="inline-flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> {fmt(defPower)}
          </span>
        </div>
        {tgt && (
          <span
            className={`rounded px-2 py-0.5 font-display text-xs ${
              verdict === "Favorable" || verdict === "Undefended"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : verdict === "Even"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/15 text-red-500"
            }`}
          >
            {verdict}
          </span>
        )}
        <button
          onClick={() => {
            if (target) dispatch({ kind: "ATTACK", targetEmpireId: target, force: committed });
          }}
          disabled={!!blocked}
          title={blocked ?? undefined}
          className="ml-auto inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 font-display text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronsUp className="h-4 w-4" strokeWidth={2.5} />
          Launch Attack (1 turn)
        </button>
      </div>
      {blocked && offensiveUnits.length > 0 && (
        <p className="px-4 pb-3 font-display text-[11px] opacity-50">{blocked}</p>
      )}
      <p className="px-4 pb-3 font-display text-[11px] opacity-40">
        Tip: {UNIT_BY_KEY.get("rocketLauncher")?.name} counters armour ·{" "}
        {UNIT_BY_KEY.get("fighterJet")?.name} counters air · turrets & satellites
        defend.
      </p>
    </section>
  );
}
