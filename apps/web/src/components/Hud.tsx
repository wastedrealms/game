import {
  turnsLeftInDay,
  dayOf,
  netPerTurn,
  type GameState,
} from "@wasted-realms/engine";
import { Play, Users, HeartPulse, Trophy } from "lucide-react";
import { RES_META, RES_ORDER, fmt } from "../ui/resources";

export function Hud({
  game,
  playerId,
  onPlayTurn,
  leaderName,
  progress,
  message,
}: {
  game: GameState;
  playerId: string;
  onPlayTurn: () => void;
  leaderName: string;
  /** Current leader's progress toward the win condition, 0..1 (drives the bar). */
  progress: number;
  /** Latest action-result message (transient status line). */
  message: string;
}) {
  const e = game.empires[playerId];
  // Turns are unlimited; "turns left" is purely a function of the current turn —
  // it counts down through the day, then flips to a fresh day (see engine rules).
  const turns = turnsLeftInDay(e.turnsPlayed, game.config);
  const net = netPerTurn(e, game.config, game.planet);

  const ranked = [...game.order].sort(
    (a, b) => game.empires[b].netWorth - game.empires[a].netWorth,
  );
  const rank = ranked.indexOf(playerId) + 1;

  const day = dayOf(e.turnsPlayed, game.config) + 1;
  // Turn within the current day (1..turnsPerDay), resetting as the day flips.
  const turnOfDay = (e.turnsPlayed % game.config.turnsPerDay) + 1;

  return (
    <section className="wr-boot rounded-lg border border-stone-200 bg-white/60 p-4 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
      {/* Left column: resources + vital stats, with the status strip UNDER them.
          Right column: Day/Turn meter + Play Turn. */}
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[1fr_13rem]">
        {/* ── Left column ────────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="grid items-start gap-x-6 gap-y-5 sm:grid-cols-[5fr_3fr]">
            {/* Resources with per-turn deltas */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-5">
              {RES_ORDER.map((k) => {
                const { Icon, cls, label } = RES_META[k];
                const d = net[k];
                return (
                  <div key={k}>
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-4 w-4 ${cls}`} strokeWidth={2.25} />
                      <span className="font-display text-lg tabular-nums">
                        {fmt(e.resources[k])}
                      </span>
                    </div>
                    <div className="whitespace-nowrap font-display text-[11px] uppercase tracking-wide opacity-50">
                      {label}{" "}
                      <span className={d < 0 ? "text-red-500" : "opacity-70"}>
                        {d >= 0 ? "+" : ""}
                        {fmt(d)}/t
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vital stats */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:border-l sm:border-stone-200 sm:pl-6 sm:dark:border-[var(--color-edge)]">
              <Stat Icon={Users} label="Population" value={`${fmt(e.population)}M`} />
              <Stat
                Icon={HeartPulse}
                label="Support"
                value={`${e.popularSupport}%`}
                warn={e.popularSupport < 50}
              />
              <Stat Icon={Trophy} label={`Net Worth · #${rank}`} value={fmt(e.netWorth)} />
            </div>
          </div>

          {/* Status — two rows under the resources: (1) protection · leader · progress,
              (2) the latest dynamic action message. */}
          <div className="mt-4 flex flex-col gap-1 border-t border-stone-200 pt-3 dark:border-[var(--color-edge)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="whitespace-nowrap font-display text-[11px] opacity-60">
                Leader: {leaderName}
              </span>
              <div
                className="h-1.5 w-28 overflow-hidden rounded-full bg-stone-300/50 dark:bg-[var(--color-edge)]"
                title="Leader's progress toward the win condition"
              >
                <div
                  className="h-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              {e.protectionTurnsLeft > 0 && (
                <span className="ml-auto whitespace-nowrap font-display text-[11px] text-[var(--color-accent)]">
                  🛡 {e.protectionTurnsLeft} turns of newbie protection remaining.
                </span>
              )}
            </div>
            {message && (
              <span className="truncate font-display text-[11px] text-[var(--color-accent)]">
                {message}
              </span>
            )}
          </div>
        </div>

        {/* ── Right column: Day/Turn + Play Turn ─────────────────────── */}
        <div className="flex flex-col gap-2 lg:border-l lg:border-stone-200 lg:pl-6 lg:dark:border-[var(--color-edge)]">
          <div>
            <div className="whitespace-nowrap font-display text-sm font-bold tabular-nums">
              Day {day} · Turn {turnOfDay}/{game.config.turnsPerDay}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: game.config.turnsPerDay }).map((_, i) => (
                <span
                  key={i}
                  className={`h-4 w-2 rounded-sm ${
                    i < turns
                      ? "bg-[var(--color-accent)]"
                      : "bg-stone-300 dark:bg-[var(--color-edge)]"
                  }`}
                />
              ))}
            </div>
            <div className="whitespace-nowrap font-display text-[11px] uppercase tracking-wide opacity-50">
              {turns} / {game.config.turnsPerDay} turns left
            </div>
          </div>
          <button
            onClick={onPlayTurn}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-display text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" strokeWidth={2.5} />
            Play Turn
          </button>
        </div>
      </div>
    </section>
  );
}

function Stat({
  Icon,
  label,
  value,
  warn,
}: {
  Icon: typeof Users;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Icon
          className={`h-4 w-4 ${warn ? "text-red-500" : "opacity-60"}`}
          strokeWidth={2.25}
        />
        <span
          className={`font-display text-lg tabular-nums ${warn ? "text-red-500" : ""}`}
        >
          {value}
        </span>
      </div>
      <div className="whitespace-nowrap font-display text-[11px] uppercase tracking-wide opacity-50">
        {label}
      </div>
    </div>
  );
}
