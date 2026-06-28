import { useState } from "react";
import {
  Sun,
  Moon,
  Globe,
  RotateCcw,
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  Hammer,
  Swords,
  Handshake,
  Map as MapIcon,
  Store,
  FlaskConical,
  Pencil,
  Info,
  Power,
} from "lucide-react";
import { useTheme } from "./useTheme";
import { useGame } from "./game/useGame";
import { Hud } from "./components/Hud";
import { BuildPanel } from "./components/BuildPanel";
import { Research } from "./components/Research";
import { Realm } from "./components/Realm";
import { Ledger } from "./components/Ledger";
import { War } from "./components/War";
import { Covert } from "./components/Covert";
import { Market } from "./components/Market";
import { HexMap } from "./components/HexMap";
import { PlanetView } from "./components/PlanetView";
import { Diplomacy } from "./components/Diplomacy";
import { Scoreboard } from "./components/Scoreboard";
import { NewsLog } from "./components/NewsLog";
import { Codex } from "./components/Codex";
import { Modal } from "./components/Modal";
import { SetupScreen } from "./components/SetupScreen";
import { AboutDialog } from "./components/AboutDialog";
import { LandingPage } from "./components/LandingPage";
import { DEFAULT_SETUP } from "./game/useGame";

type View = "command" | "codex";
type Tab =
  | "overview"
  | "map"
  | "planet"
  | "build"
  | "research"
  | "market"
  | "military"
  | "diplomacy";

const TABS: { key: Tab; label: string; Icon: typeof Globe }[] = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "map", label: "Map", Icon: MapIcon },
  { key: "planet", label: "Planet", Icon: Globe },
  { key: "build", label: "Build", Icon: Hammer },
  { key: "research", label: "Research", Icon: FlaskConical },
  { key: "military", label: "Military", Icon: Swords },
  { key: "diplomacy", label: "Diplomacy", Icon: Handshake },
  { key: "market", label: "Market", Icon: Store },
];

export function App() {
  const { theme, toggle } = useTheme();
  const { game, dispatch, newGame, endGame, message, playerId, victory } = useGame();
  const [view, setView] = useState<View>("command");
  const [tab, setTab] = useState<Tab>("overview");
  const [setupOpen, setSetupOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [dismissedWin, setDismissedWin] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const leaderName = game && victory ? game.empires[victory.leaderId]?.name ?? "—" : "—";
  const playerWon = !!victory?.over && victory.winnerId === playerId;

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-stone-300/70 bg-stone-50/80 backdrop-blur-md dark:border-[var(--color-edge)] dark:bg-[var(--color-void)]/80">
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Globe className="h-6 w-6 shrink-0 text-[var(--color-accent)]" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-base font-bold tracking-tight sm:text-lg">
                WASTED REALMS
              </h1>
            <p className="flex h-4 items-center gap-1 font-display text-[11px] uppercase tracking-[0.2em] opacity-50">
              {game ? (
                <>
                  {editingName ? (
                    <input
                      autoFocus
                      defaultValue={game.empires[playerId].name}
                      maxLength={28}
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        // Only rename if it actually changed — a stray click shouldn't log a rename.
                        if (v && v !== game.empires[playerId].name) {
                          dispatch({ kind: "SET_NAME", name: v });
                        }
                        setEditingName(false);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                        if (ev.key === "Escape") setEditingName(false);
                      }}
                      className="my-[-1px] h-4 w-40 rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] normal-case leading-none tracking-normal text-stone-900 dark:border-[var(--color-edge)] dark:bg-[var(--color-void)] dark:text-stone-100"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingName(true)}
                      title="Rename your realm"
                      className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-accent)]"
                    >
                      {game.empires[playerId].name}
                      <Pencil className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  )}
                </>
              ) : (
                <span className="normal-case tracking-normal">Free 4X empire remake</span>
              )}
            </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <nav className="flex gap-1">
            <NavBtn on={view === "command"} onClick={() => setView("command")} Icon={Gamepad2}>
              Command
            </NavBtn>
            <NavBtn on={view === "codex"} onClick={() => setView("codex")} Icon={BookOpen}>
              Codex
            </NavBtn>
          </nav>

          <button
            onClick={() => setAboutOpen(true)}
            aria-label="About & support"
            title="About Wasted Realms · support"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-2.5 py-1.5 font-display text-xs uppercase tracking-wider transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] dark:border-[var(--color-edge)]"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSetupOpen(true)}
            aria-label="New game"
            title="Start a new realm"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-2.5 py-1.5 font-display text-xs uppercase tracking-wider transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] dark:border-[var(--color-edge)]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          {game && (
            <button
              onClick={() => setEndConfirmOpen(true)}
              aria-label="End game"
              title="End game — return to start"
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-2.5 py-1.5 font-display text-xs uppercase tracking-wider transition-colors hover:border-red-500 hover:text-red-500 dark:border-[var(--color-edge)]"
            >
              <Power className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-1.5 font-display text-xs uppercase tracking-wider transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] dark:border-[var(--color-edge)]"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "Day Ops" : "Night Ops"}</span>
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-5 py-6">
        {view === "codex" ? (
          <Codex />
        ) : !game || !victory ? (
          <LandingPage onCreate={() => setSetupOpen(true)} />
        ) : (
          <>
            <Hud
              game={game}
              playerId={playerId}
              onPlayTurn={() => dispatch({ kind: "PLAY_TURN" })}
              leaderName={leaderName}
              progress={victory.progress}
              message={message}
            />

            {/* Full-width sub-tab nav — one row at full width; wraps on smaller views. */}
            <div className="flex flex-wrap gap-1">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 font-display text-[13px] transition-colors ${
                    tab === key
                      ? "bg-[var(--color-accent)] text-black"
                      : "border border-stone-300 hover:border-[var(--color-accent)] dark:border-[var(--color-edge)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content is now full width; Scoreboard + News live inside Overview. */}
            <div className="space-y-4">
              {tab === "overview" && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  {/* Left column: the two panels (Realm + Ledger). */}
                  <div className="space-y-4">
                    <Realm game={game} playerId={playerId} dispatch={dispatch} victory={victory} />
                    <Ledger game={game} playerId={playerId} />
                  </div>
                  {/* Right column: Scoreboard + News Feed. On lg, the inner stack is
                      absolutely filled so the LEFT column drives the height — News Feed
                      caps to the page content and scrolls internally, never inflating it. */}
                  <div className="lg:relative">
                    <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
                      <Scoreboard game={game} playerId={playerId} />
                      <NewsLog game={game} />
                    </div>
                  </div>
                </div>
              )}
              {tab === "map" && (
                <HexMap game={game} playerId={playerId} dispatch={dispatch} />
              )}
              {tab === "planet" && (
                <PlanetView game={game} playerId={playerId} dispatch={dispatch} />
              )}
              {tab === "build" && (
                <BuildPanel game={game} playerId={playerId} dispatch={dispatch} />
              )}
              {tab === "research" && (
                <Research game={game} playerId={playerId} dispatch={dispatch} />
              )}
              {tab === "market" && (
                <Market game={game} playerId={playerId} dispatch={dispatch} />
              )}
              {tab === "military" && (
                <>
                  <War game={game} playerId={playerId} dispatch={dispatch} />
                  <Covert game={game} playerId={playerId} dispatch={dispatch} />
                </>
              )}
              {tab === "diplomacy" && (
                <Diplomacy game={game} playerId={playerId} dispatch={dispatch} />
              )}
            </div>
          </>
        )}
      </main>

      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}

      <Modal
        open={endConfirmOpen}
        title="End this game?"
        body="Your current realm will be discarded and you'll return to the start screen. This can't be undone."
        confirmLabel="End game"
        cancelLabel="Keep playing"
        onConfirm={() => {
          endGame();
          setEndConfirmOpen(false);
          setView("command");
          setTab("overview");
        }}
        onCancel={() => setEndConfirmOpen(false)}
      />

      {setupOpen && (
        <SetupScreen
          initial={DEFAULT_SETUP}
          onStart={(s) => {
            newGame(s);
            setSetupOpen(false);
            setDismissedWin(false);
            setTab("overview");
          }}
          onCancel={() => setSetupOpen(false)}
        />
      )}

      <Modal
        open={!!victory?.over && !dismissedWin}
        title={playerWon ? "Victory!" : "Game over"}
        body={victory?.reason ?? ""}
        confirmLabel="New game"
        cancelLabel="View final realm"
        onConfirm={() => {
          setDismissedWin(true);
          setSetupOpen(true);
        }}
        onCancel={() => setDismissedWin(true)}
      />
    </div>
  );
}

function NavBtn({
  on,
  onClick,
  Icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  Icon: typeof Globe;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 font-display text-sm transition-colors sm:px-3 ${
        on
          ? "bg-[var(--color-accent)] text-black"
          : "border border-stone-300 hover:border-[var(--color-accent)] dark:border-[var(--color-edge)]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}
