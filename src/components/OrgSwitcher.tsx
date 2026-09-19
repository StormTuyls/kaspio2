import { useEffect, useRef, useState } from "react";
import type { Organisation } from "../supabase";
import { useConfirm } from "./ConfirmDialog";

type Props = {
  orgs: Organisation[];
  selected: Organisation;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  /** Verlaat de huidige org. Geef een foutmelding terug (bv. enige beheerder). */
  onLeave?: (id: string) => Promise<{ error: string | null }>;
  /** Donker variant voor donkere sidebar. */
  variant?: "light" | "dark";
};

export function OrgSwitcher({
  orgs,
  selected,
  onSelect,
  onCreateNew,
  onLeave,
  variant = "dark",
}: Props) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    if (!onLeave || leaving) return;
    if (
      !(await confirm({
        title: `"${selected.name}" verlaten?`,
        message: "Je verliest je toegang tot deze organisatie.",
        confirmLabel: "Verlaten",
        danger: true,
      }))
    )
      return;
    setLeaveErr(null);
    setLeaving(true);
    const res = await onLeave(selected.id);
    setLeaving(false);
    if (res.error) {
      setLeaveErr(res.error);
    } else {
      setOpen(false);
    }
  }
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDark = variant === "dark";

  // Klik buiten = sluit dropdown
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Als er maar één org is en geen optie om nieuwe te maken, toon enkel naam zonder dropdown
  // (we tonen 'm wel altijd zodat user kan zien dat er een mogelijkheid is om bij te voegen)

  const triggerClasses = isDark
    ? "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition hover:bg-white/5"
    : "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition hover:bg-ink-50";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClasses}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className={`min-w-0 flex-1 truncate text-xs ${
            isDark ? "text-ink-300" : "text-basis"
          }`}
        >
          {selected.name}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isDark ? "text-ink-400" : "text-zacht"}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-zacht">
            Organisaties
          </div>
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-ink-50 dark:hover:bg-ink-800 ${
                o.id === selected.id
                  ? "font-semibold text-ink-900 dark:text-white"
                  : "text-ink-800 dark:text-ink-300"
              }`}
            >
              <span className="truncate">{o.name}</span>
              {o.id === selected.id && (
                <span className="text-in-600" aria-label="Geselecteerd">
                  ✓
                </span>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-ink-200 dark:border-ink-800" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCreateNew();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-in-700 transition hover:bg-in-100 dark:text-in-400 dark:hover:bg-ink-800"
          >
            <span aria-hidden>+</span>
            <span>Nieuwe organisatie</span>
          </button>

          {onLeave && (
            <button
              type="button"
              role="menuitem"
              onClick={handleLeave}
              disabled={leaving}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fout-600 transition hover:bg-fout-100 disabled:opacity-60 dark:text-fout-400 dark:hover:bg-ink-800"
            >
              <span aria-hidden>↪</span>
              <span>{leaving ? "Bezig…" : `"${selected.name}" verlaten`}</span>
            </button>
          )}
          {leaveErr && (
            <p className="px-3 py-1.5 text-xs text-fout-600 dark:text-fout-400">
              {leaveErr}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
