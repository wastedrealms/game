import { useEffect } from "react";

/** A small in-window confirmation modal (replaces the browser confirm dialog). */
export function Modal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="wr-boot w-full max-w-sm rounded-lg border border-stone-300 bg-stone-50 p-5 shadow-2xl dark:border-[var(--color-edge)] dark:bg-[var(--color-panel)]"
      >
        <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
        <p className="mt-2 font-display text-sm opacity-70">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-stone-300 px-3 py-1.5 font-display text-sm transition-colors hover:bg-stone-100 dark:border-[var(--color-edge)] dark:hover:bg-white/[0.04]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 font-display text-sm font-bold text-white transition-opacity hover:opacity-90 ${
              danger ? "bg-red-600" : "bg-[var(--color-accent)] text-black"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
