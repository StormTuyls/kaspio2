import { useEffect } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Dialoog-shell. Op touch een bottom sheet die tegen de onderrand plakt, vanaf
 * `sm` de klassieke gecentreerde modal. `dvh` in plaats van `vh` omdat de
 * URL-balk van mobiele browsers `vh` niet meekrimpt, waardoor de onderkant van
 * een `85vh`-paneel buiten beeld valt.
 */
export function Modal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Achtergrond niet laten meescrollen zolang de sheet open staat. Zonder dit
  // scrollt op mobiel de pagina achter de dialoog weg zodra je in de sheet
  // voorbij het einde swipet.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[85dvh] sm:max-w-md sm:rounded-2xl dark:bg-navy-900 dark:ring-1 dark:ring-navy-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-navy-100 px-5 py-4 dark:border-navy-700/60">
          <h2 className="min-w-0 truncate text-lg font-bold text-navy-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="-mr-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 sm:h-8 sm:w-8 dark:hover:bg-navy-800 dark:hover:text-white"
            aria-label="Sluiten"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}
