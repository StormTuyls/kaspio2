import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Breedte vanaf `sm`. Standaard "md", wat past voor een formulier met een
   * handvol velden. Gebruik "lg" voor een lijst die je moet kunnen overzien:
   * daar telt elke kolom, en op 28rem knijp je datum, rekening en mededeling
   * tot ze onleesbaar zijn.
   */
  size?: "md" | "lg";
};

/** Wat de focus mag krijgen binnen de dialoog. */
const FOCUSBAAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialoog-shell. Op touch een bottom sheet die tegen de onderrand plakt, vanaf
 * `sm` de klassieke gecentreerde modal. `dvh` in plaats van `vh` omdat de
 * URL-balk van mobiele browsers `vh` niet meekrimpt, waardoor de onderkant van
 * een `85vh`-paneel buiten beeld valt.
 *
 * Toegankelijkheid zat hier niet in en is nu wel geregeld. Voorheen was dit
 * voor een schermlezer gewoon een div ergens op de pagina: geen rol, geen
 * naam, en Tab liep zo de achtergrond in. Vier dingen zijn erbij gekomen:
 *
 *   1. `role="dialog"` met `aria-modal` en een `aria-labelledby` die naar de
 *      titel wijst, zodat de dialoog een naam heeft.
 *   2. De focus springt bij openen naar het paneel in plaats van achter te
 *      blijven op de knop eronder.
 *   3. Tab en Shift+Tab blijven binnen de dialoog.
 *   4. Bij sluiten gaat de focus terug naar het element dat hem opende, zodat
 *      je niet bovenaan de pagina belandt.
 */
export function Modal({ open, title, onClose, children, size = "md" }: Props) {
  const paneel = useRef<HTMLDivElement>(null);
  const vorigeFocus = useRef<HTMLElement | null>(null);
  const titelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !paneel.current) return;

      const items = [...paneel.current.querySelectorAll<HTMLElement>(FOCUSBAAR)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        e.preventDefault();
        paneel.current.focus();
        return;
      }
      const eerste = items[0];
      const laatste = items[items.length - 1];
      const actief = document.activeElement;
      if (e.shiftKey && (actief === eerste || actief === paneel.current)) {
        e.preventDefault();
        laatste.focus();
      } else if (!e.shiftKey && actief === laatste) {
        e.preventDefault();
        eerste.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus naar binnen bij openen, en terug naar de opener bij sluiten.
  useEffect(() => {
    if (!open) return;
    vorigeFocus.current = document.activeElement as HTMLElement | null;
    // Naar het paneel zelf en niet naar het eerste veld: bij een formulier met
    // een tekstveld klapt anders meteen het toetsenbord op mobiel open.
    paneel.current?.focus();
    return () => vorigeFocus.current?.focus?.();
  }, [open]);

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
      className="fixed inset-0 flex items-end justify-center bg-ink-950/45 backdrop-blur-[2px] sm:items-center sm:p-4"
      style={{ zIndex: "var(--z-modal)" }}
      onClick={onClose}
    >
      <div
        ref={paneel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-lg bg-white outline-none sm:max-h-[85dvh] sm:rounded-lg ${
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-md"
        } dark:bg-ink-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-5 py-3.5 dark:border-ink-800">
          <h2
            id={titelId}
            className="min-w-0 truncate text-[1.0625rem] font-semibold text-sterk"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="-mr-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 sm:h-8 sm:w-8 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            aria-label="Sluiten"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
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
