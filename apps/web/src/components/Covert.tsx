import { useState } from "react";
import {
  covertSuccessChance,
  type Action,
  type CovertOp,
  type GameState,
} from "@wasted-realms/engine";
import { EyeOff, Bot, Crown, Eye, Flame, Bomb, SatelliteDish } from "lucide-react";
import { canReconEnemies } from "../ui/empireColors";

const OPS: { key: CovertOp; label: string; Icon: typeof Eye; desc: string }[] = [
  { key: "spy", label: "Spy", Icon: Eye, desc: "Reveal their stockpiles & forces" },
  { key: "incite", label: "Incite Dissent", Icon: Flame, desc: "Lower popular support" },
  { key: "sabotage", label: "Sabotage", Icon: Bomb, desc: "Steal credits from the treasury" },
];

export function Covert({
  game,
  playerId,
  dispatch,
}: {
  game: GameState;
  playerId: string;
  dispatch: (a: Action) => void;
}) {
  const me = game.empires[playerId];
  const agentsOwned = me.units.covertAgent ?? 0;
  const others = game.order.filter((id) => id !== playerId);

  const [target, setTarget] = useState<string | null>(null);
  const [op, setOp] = useState<CovertOp>("spy");
  const [agents, setAgents] = useState<number>(0);

  const commit = Math.min(agentsOwned, agents || agentsOwned);
  // A Recon/Defense Satellite guides agents to their targets (+success).
  const recon = canReconEnemies(game, playerId);
  const chance = Math.round(covertSuccessChance(commit, game.config.covert, recon) * 100);
  const tgt = target ? game.empires[target] : null;

  const blocked =
    agentsOwned <= 0
      ? "Recruit Covert Agents (Command Center) to run operations."
      : me.turns < 1
        ? "No turns remaining."
        : !tgt
          ? "Select a target."
          : tgt.protectionTurnsLeft > 0
            ? `${tgt.name} is under protection.`
            : null;

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      <h2 className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest opacity-70 dark:border-[var(--color-edge)]">
        <EyeOff className="h-3.5 w-3.5" /> Covert Ops
        <span className="ml-auto normal-case opacity-60">{agentsOwned} agents</span>
      </h2>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Target
          </h3>
          <ul className="space-y-1.5">
            {others.map((id) => {
              const e = game.empires[id];
              const prot = e.protectionTurnsLeft > 0;
              return (
                <li key={id}>
                  <button
                    onClick={() => setTarget(id)}
                    disabled={prot}
                    className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left font-display text-sm transition-colors disabled:opacity-40 ${
                      target === id
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
                    {prot && <span className="text-[10px]">🛡</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Operation
          </h3>
          <ul className="space-y-1.5">
            {OPS.map(({ key, label, Icon, desc }) => (
              <li key={key}>
                <button
                  onClick={() => setOp(key)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left font-display text-sm transition-colors ${
                    op === key
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                      : "border-stone-300 hover:border-[var(--color-accent)] dark:border-[var(--color-edge)]"
                  }`}
                  title={desc}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
          {agentsOwned > 0 && (
            <label className="mt-3 block font-display text-xs">
              Agents to commit
              <input
                type="number"
                min={1}
                max={agentsOwned}
                value={agents || agentsOwned}
                onChange={(e) =>
                  setAgents(Math.max(1, Math.min(agentsOwned, Number(e.target.value))))
                }
                className="mt-1 w-full rounded border border-stone-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-[var(--color-edge)]"
              />
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-stone-200 px-4 py-3 dark:border-[var(--color-edge)]">
        <span className="font-display text-sm">
          Success chance:{" "}
          <span className="text-[var(--color-accent)]">{chance}%</span>
          {recon && (
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] opacity-60">
              <SatelliteDish className="h-3 w-3" /> orbital recon
            </span>
          )}
        </span>
        <button
          onClick={() => {
            if (target)
              dispatch({
                kind: "COVERT_OP",
                targetEmpireId: target,
                operation: op,
                agents: commit,
              });
          }}
          disabled={!!blocked}
          title={blocked ?? undefined}
          className="ml-auto inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 font-display text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <EyeOff className="h-4 w-4" strokeWidth={2.5} />
          Run Operation (1 turn)
        </button>
      </div>
      {blocked && (
        <p className="px-4 pb-3 font-display text-[11px] opacity-50">{blocked}</p>
      )}
    </section>
  );
}
