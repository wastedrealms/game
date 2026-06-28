import { useState } from "react";
import {
  PLANET_SIZES,
  type PlanetSize,
  type VictoryType,
  type GameLength,
} from "@wasted-realms/engine";
import { Globe, Rocket, Users, Trophy, Hourglass, Flag, Play, X, Palette, Check } from "lucide-react";
import type { SetupOptions } from "../game/useGame";
import { ALL_HUES } from "../ui/empireColors";

const PLANET_OPTS: { key: PlanetSize; label: string }[] = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
  { key: "extra", label: "Extra" },
  { key: "ultra", label: "Ultra" },
];

const WIN_OPTS: { key: VictoryType; label: string; desc: string }[] = [
  { key: "score", label: "Score", desc: "Highest net worth at the deadline" },
  { key: "economic", label: "Economic", desc: "First to the net-worth target" },
  { key: "domination", label: "Domination", desc: "Control most of the planet" },
  { key: "tech", label: "Tech", desc: "First to the goal research milestone" },
];

const LEN_OPTS: { key: GameLength; label: string; desc: string }[] = [
  { key: "short", label: "Short", desc: "~2–3 h" },
  { key: "medium", label: "Medium", desc: "~5–7 h" },
  { key: "long", label: "Long", desc: "~10–14 h" },
];

const START_OPTS: { key: SetupOptions["startMode"]; label: string; desc: string }[] = [
  { key: "preset", label: "Preset realm", desc: "Start with a balanced territory" },
  { key: "custom", label: "Custom", desc: "Tiny start + 6,000 credits to claim your own" },
];

export function SetupScreen({
  initial,
  onStart,
  onCancel,
}: {
  initial: SetupOptions;
  onStart: (s: SetupOptions) => void;
  onCancel: () => void;
}) {
  const [s, setS] = useState<SetupOptions>(initial);
  const set = <K extends keyof SetupOptions>(k: K, v: SetupOptions[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="wr-boot max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-stone-300 bg-stone-50 p-5 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="font-display text-lg font-bold tracking-tight">NEW REALM</h2>
          <button onClick={onCancel} aria-label="Cancel" className="ml-auto opacity-60 hover:opacity-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Opponents */}
        {/* Realm name */}
        <Section icon={Flag} title="Realm name">
          <input
            type="text"
            value={s.empireName}
            maxLength={28}
            placeholder="Your Realm"
            onChange={(e) => set("empireName", e.target.value)}
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-display text-sm text-stone-900 placeholder:opacity-40 dark:border-[var(--color-edge)] dark:bg-[var(--color-void)] dark:text-stone-100"
          />
        </Section>

        {/* Realm color — rivals take the rest of the palette (shuffled per game). */}
        <Section icon={Palette} title="Realm color">
          <div className="flex flex-wrap gap-2">
            {ALL_HUES.map((hue) => (
              <button
                key={hue}
                onClick={() => set("empireHue", hue)}
                aria-label={`Use ${hue}`}
                title="Your realm color"
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border-2 transition-transform hover:scale-110 ${
                  s.empireHue === hue ? "border-white" : "border-transparent"
                }`}
                style={{ background: hue }}
              >
                {s.empireHue === hue && <Check className="h-4 w-4 text-black" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Users} title="Opponents">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pick key={n} on={s.npcs === n} onClick={() => set("npcs", n)}>
                {n}
              </Pick>
            ))}
          </div>
          <p className="mt-1 text-xs opacity-50">{s.npcs + 1} empires total (max 8).</p>
        </Section>

        {/* Planet size */}
        <Section icon={Rocket} title="Planet size">
          <div className="flex flex-wrap gap-1.5">
            {PLANET_OPTS.map((o) => (
              <Pick key={o.key} on={s.planetSize === o.key} onClick={() => set("planetSize", o.key)}>
                {o.label}
              </Pick>
            ))}
          </div>
          <p className="mt-1 text-xs opacity-50">
            {PLANET_SIZES[s.planetSize]} regions available.
          </p>
        </Section>

        {/* Victory */}
        <Section icon={Trophy} title="Victory condition">
          <div className="flex flex-wrap gap-1.5">
            {WIN_OPTS.map((o) => (
              <Pick key={o.key} on={s.winType === o.key} onClick={() => set("winType", o.key)} title={o.desc}>
                {o.label}
              </Pick>
            ))}
          </div>
          <p className="mt-1 text-xs opacity-50">{WIN_OPTS.find((o) => o.key === s.winType)?.desc}</p>
        </Section>

        {/* Length */}
        <Section icon={Hourglass} title="Game length">
          <div className="flex flex-wrap gap-1.5">
            {LEN_OPTS.map((o) => (
              <Pick key={o.key} on={s.gameLength === o.key} onClick={() => set("gameLength", o.key)}>
                {o.label} <span className="opacity-50">{o.desc}</span>
              </Pick>
            ))}
          </div>
        </Section>

        {/* Starting territory */}
        <Section icon={Flag} title="Starting territory">
          <div className="flex flex-wrap gap-1.5">
            {START_OPTS.map((o) => (
              <Pick key={o.key} on={s.startMode === o.key} onClick={() => set("startMode", o.key)} title={o.desc}>
                {o.label}
              </Pick>
            ))}
          </div>
          <p className="mt-1 text-xs opacity-50">{START_OPTS.find((o) => o.key === s.startMode)?.desc}</p>
        </Section>

        <button
          onClick={() => onStart(s)}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-black"
        >
          <Play className="h-4 w-4" /> Begin
        </button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Globe;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-widest opacity-70">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

function Pick({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md px-3 py-1.5 font-display text-sm transition-colors ${
        on
          ? "bg-[var(--color-accent)] text-black"
          : "border border-stone-300 hover:border-[var(--color-accent)] dark:border-[var(--color-edge)]"
      }`}
    >
      {children}
    </button>
  );
}
