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
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-navy-900 dark:text-white">
            Aan de slag met Kaspio
          </h2>
          <p className="text-sm text-navy-500 dark:text-navy-300">
            Nog {steps.length - doneCount} van {steps.length} stappen te gaan.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-xs font-medium text-navy-400 hover:text-navy-700 dark:hover:text-navy-100"
        >
          Verbergen
        </button>
      </div>

      {!hasPot && onUseTemplate && (
        <button
          onClick={onUseTemplate}
          className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50 dark:border-teal-900/50 dark:bg-teal-900/20"
        >
          <span>
            <span className="block text-sm font-bold text-teal-800 dark:text-teal-200">
              Snel opzetten met een sjabloon
            </span>
            <span className="block text-xs text-teal-700/80 dark:text-teal-300/80">
              Kies je situatie, wij zetten de potjes klaar.
            </span>
          </span>
          <span className="flex-shrink-0 text-teal-600 dark:text-teal-300" aria-hidden>
            →
          </span>
        </button>
      )}

      <ul className="space-y-2.5">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-navy-100 bg-canvas px-3 py-2.5 dark:border-navy-700/60 dark:bg-navy-800/40"
          >
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-teal-500 text-white"
                  : "border-2 border-navy-200 text-navy-300 dark:border-navy-600"
              }`}
              aria-hidden
            >
              {step.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold ${
                  step.done
                    ? "text-navy-400 line-through dark:text-navy-500"
                    : "text-navy-900 dark:text-navy-50"
                }`}
              >
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-navy-500 dark:text-navy-300">{step.hint}</p>
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
    </div>
  );
}
