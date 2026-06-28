import { useEffect, useRef, useState } from "react";

/** Small dialog for renaming your realm — replaces the inline header input (poor on mobile). */
export function RenameDialog({
  current,
  onSave,
  onClose,
}: {
  current: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select the text so the user can type over it immediately.
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = () => {
    const v = value.trim();
    // Only rename if it actually changed — a stray confirm shouldn't log a rename.
    if (v && v !== current) onSave(v);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="wr-boot w-full max-w-sm rounded-lg border border-stone-300 bg-stone-50 p-5 shadow-2xl dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]"
      >
        <h2 className="font-display text-base font-bold tracking-tight">Rename your realm</h2>
        <input
          ref={inputRef}
          value={value}
          maxLength={28}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") onClose();
          }}
          className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-display text-sm text-stone-900 outline-none focus:border-[var(--color-accent)] dark:border-[var(--color-edge)] dark:bg-[var(--color-void)] dark:text-stone-100"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-stone-300 px-3 py-1.5 font-display text-sm transition-colors hover:bg-stone-100 dark:border-[var(--color-edge)] dark:hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 font-display text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
