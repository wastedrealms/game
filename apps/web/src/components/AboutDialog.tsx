import { X, Coffee, Heart, Lightbulb, Bug, ExternalLink } from "lucide-react";
import { donateUrl, ideaUrl, bugUrl, SITE_URL } from "../ui/links";
import heroImg from "../assets/wastedrealms.webp";

const TIERS = [3, 5, 10];

const linkBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 font-display text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] dark:border-[var(--color-edge)]";

/** Info / Donate dialog — free-to-play pitch, optional donations, feedback links. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="wr-boot relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-stone-300 bg-stone-50 p-5 dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded bg-black/40 p-1 text-white/80 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <img
          src={heroImg}
          alt="Wasted Realms"
          className="mb-4 w-full rounded-md border border-stone-200/40 dark:border-[var(--color-edge)]"
        />

        <p className="font-display text-sm leading-relaxed opacity-80">
          A free, modern remake of the BBS classics{" "}
          <span className="text-[var(--color-accent)]">Barren Realms Elite</span> &amp;{" "}
          <span className="text-[var(--color-accent)]">Solar Realms Elite</span>. Balance Fuel / Food /
          Credits, expand across regions, and research your way up the tech tree to the stars.
        </p>
        <p className="mt-2 font-display text-xs opacity-50">
          Free to play — no ads, no paywall. Hosted for the love of the genre.
        </p>

        {/* Donate */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-widest opacity-70">
            <Coffee className="h-3.5 w-3.5" /> Support development
          </div>
          <p className="mb-2 font-display text-xs opacity-70">
            Having fun? Buy us a coffee — entirely optional, and hugely appreciated.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TIERS.map((amt) => (
              <a key={amt} href={donateUrl(amt)} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                <Coffee className="h-3.5 w-3.5" /> ${amt}
              </a>
            ))}
            <a
              href={donateUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 font-display text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Heart className="h-3.5 w-3.5" strokeWidth={2.5} /> Custom
            </a>
          </div>
        </div>

        {/* Feedback */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-widest opacity-70">
            <Lightbulb className="h-3.5 w-3.5" /> Feedback
          </div>
          <p className="mb-2 font-display text-xs opacity-70">
            Got an idea or hit a bug? Tell us on GitHub.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <a href={ideaUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
              <Lightbulb className="h-3.5 w-3.5" /> Suggest an idea
            </a>
            <a href={bugUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
              <Bug className="h-3.5 w-3.5" /> Report a bug
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 flex items-center gap-1 font-display text-[11px] opacity-40">
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-100">
            wastedrealms.com <ExternalLink className="h-3 w-3" />
          </a>
          <span>· an empires.io project</span>
        </p>
      </div>
    </div>
  );
}
