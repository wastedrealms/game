import { Play, Map as MapIcon, Hammer, FlaskConical, Trophy } from "lucide-react";
import heroImg from "../assets/wastedrealms.webp";

const STEPS = [
  {
    Icon: MapIcon,
    title: "Claim land",
    body: "Buy regions on a shared planet — each terrain feeds a different resource.",
  },
  {
    Icon: Hammer,
    title: "Build & balance",
    body: "Raise structures to turn terrain into Credits, Food & Fuel — keep income ahead of upkeep.",
  },
  {
    Icon: FlaskConical,
    title: "Research & expand",
    body: "Climb the tech tree, field troops, run covert ops, and outgrow your rivals.",
  },
  {
    Icon: Trophy,
    title: "Win",
    body: "Top the net-worth scoreboard — or hit your economic, domination, or tech goal by the deadline.",
  },
];

/** Shown when there's no game yet — brand, pitch, a create CTA, and a how-it-works primer. */
export function LandingPage({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 text-center">
      <img
        src={heroImg}
        alt="Wasted Realms"
        className="mx-auto mb-7 w-full max-w-xl rounded-lg border border-stone-200/40 dark:border-[var(--color-edge)]"
      />

      <p className="mx-auto max-w-2xl font-display text-base leading-relaxed opacity-80">
        A free, modern remake of the BBS classics{" "}
        <span className="text-[var(--color-accent)]">Barren Realms Elite</span> &amp;{" "}
        <span className="text-[var(--color-accent)]">Solar Realms Elite</span>. Rule an empire on a
        shared planet — balance a Credits / Food / Fuel economy, research up the tech tree, and
        outlast your rivals.
      </p>

      <button
        onClick={onCreate}
        className="mt-7 inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90"
      >
        <Play className="h-4 w-4" strokeWidth={2.5} /> Create your realm
      </button>
      <p className="mt-2 font-display text-xs opacity-50">Free to play — no ads, no paywall.</p>

      <div className="mt-12">
        <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-widest opacity-70">
          How it works
        </h2>
        <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className="rounded-lg border border-stone-200 bg-white/60 p-4 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]"
            >
              <div className="mb-2 flex items-start gap-2">
                <span className="mt-0.5 font-display text-xs tabular-nums opacity-40">{i + 1}</span>
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <span className="min-w-0 flex-1 font-display text-sm font-medium leading-tight">
                  {title}
                </span>
              </div>
              <p className="font-display text-xs leading-relaxed opacity-70">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
