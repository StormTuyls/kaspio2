import { useState } from "react";
import type { Pot, Transaction } from "../types";

type Props = {
  /** Per org onthouden of de checklist weggeklikt is. */
  orgId: string;
  /**
   * Staan de potjes en transacties er nog niet? Dan zeggen lege lijsten niets.
   * De checklist leidt "gedaan" af uit de data, dus zonder deze vlag lijkt elke
   * org tijdens het laden leeg en flitst de checklist bij elke reload voorbij
   * voordat de cijfers verschijnen.
   */
  loading?: boolean;
  pots: Pot[];
  transactions: Transaction[];
  onAddPot: () => void;
  /** Geld toevoegen aan de hoofdpot (opent hetzelfde scherm als de saldokaart). */
  onAddMoney: () => void;
  onImport?: () => void;
  onOpenInbox: () => void;
  /** Open de opzet-wizard (sjablonen). Alleen zinvol zolang er nog geen potjes zijn. */
  onUseTemplate?: () => void;
};

/**
 * First-run checklist op het dashboard. Toont de drie stappen om Kaspio op te
 * zetten en verdwijnt vanzelf als alles gedaan is (of wanneer je 'm wegklikt).
 * De "gedaan"-status wordt uit de data afgeleid, niet apart bijgehouden.
 */
export function OnboardingChecklist({
  orgId,
  loading,
  pots,
  transactions,
  onAddPot,
  onAddMoney,
  onImport,
  onOpenInbox,
  onUseTemplate,
}: Props) {
  const storageKey = `kaspio:onboarding-dismissed:${orgId}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const hasPot = pots.length > 0;
  const hasMoney = transactions.length > 0;
  const hasAllocated = transactions.some((t) => t.potId !== null);

  const steps = [
    {
      done: hasPot,
      label: "Maak je eerste potje",
      hint: "Een potje per persoon, team of doel.",
      cta: "Potje maken",
      action: onAddPot,
    },
    {
      done: hasMoney,
      label: "Voeg geld toe",
      hint: "Zet je beginsaldo of importeer je rekeninguittreksel.",
      cta: "Geld toevoegen",
      action: onAddMoney,
      secondary: onImport ? { cta: "Importeer", action: onImport } : undefined,
    },
    {
      done: hasAllocated,
      label: "Verdeel je geld over de potjes",
      hint: "Wijs binnengekomen geld toe aan het juiste potje.",
      cta: "Toewijzen",
      action: onOpenInbox,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  // Tijdens het laden niets tonen: "nog niet binnen" is geen "nog niet gedaan".
  if (loading || dismissed || allDone) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // localStorage geblokkeerd: dan blijft de checklist deze sessie staan.
    }
    setDismissed(true);
  }

  return (
    <section aria-label="Aan de slag met Kaspio" className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="sectiekop">Aan de slag met Kaspio</p>
          <p className="text-sm text-basis">
            Nog {steps.length - doneCount} van {steps.length} stappen te gaan.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-xs font-medium text-zacht hover:text-ink-800 dark:hover:text-ink-200"
        >
          Verbergen
        </button>
      </div>

      {!hasPot && onUseTemplate && (
        <button
          onClick={onUseTemplate}
          className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
          style={{ boxShadow: "inset 0 0 0 1px var(--lijn-sterk)" }}
        >
          <span>
            <span className="block text-sm font-bold text-sterk">
              Snel opzetten met een sjabloon
            </span>
            <span className="block text-xs text-zacht">
              Kies je situatie, wij zetten de potjes klaar.
            </span>
          </span>
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 text-zacht"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}

      <ul className="space-y-2.5">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 dark:border-ink-800/60 dark:bg-ink-900/40"
          >
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-in-600 text-white"
                  : "border-2 border-ink-300 text-zwak dark:border-ink-600"
              }`}
              aria-hidden
            >
              {step.done && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold ${
                  step.done
                    ? "text-zacht line-through"
                    : "text-sterk"
                }`}
              >
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-basis">{step.hint}</p>
              )}
            </div>
            {/* Op mobiel zakken de knoppen naar een eigen regel. Een stap met
                twee acties liet anders zo'n 18px over voor label en hint. */}
            {!step.done && (
              <div className="flex w-full flex-shrink-0 justify-end gap-2 sm:w-auto">
                {step.secondary && (
                  <button
                    onClick={step.secondary.action}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {step.secondary.cta}
                  </button>
                )}
                <button onClick={step.action} className="btn-accent px-3 py-1.5 text-xs">
                  {step.cta}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
