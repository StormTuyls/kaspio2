import { useState } from "react";
import type { SubTier } from "../supabase";
import { groupsEnabled } from "../data";
import { SETUP_TEMPLATES, type SetupTemplate, type TemplatePot } from "../setupTemplates";

type Props = {
  tier: SubTier;
  /** Aantal potjes dat er nog bij mag (limiet minus bestaande). Kan Infinity. */
  availableSlots: number;
  onApply: (sel: {
    groups: string[];
    pots: TemplatePot[];
  }) => Promise<{ error: string | null }>;
  onClose: () => void;
};

/**
 * Optionele opzet-wizard: kies een sjabloon en maak in één keer een setje
 * potjes aan, zodat je niet vanaf nul begint. Houdt rekening met de tier:
 * potjes worden gecapt op de vrije plaatsen en groepen enkel aangemaakt op team.
 */
export function SetupWizard({ tier, availableSlots, onApply, onClose }: Props) {
  const [template, setTemplate] = useState<SetupTemplate | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useGroups = groupsEnabled(tier);

  if (!template) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-700 dark:text-ink-500">
          Waarvoor gebruik je Kaspio? We zetten meteen een paar zinnige potjes
          voor je klaar. Aanpassen kan altijd.
        </p>
        {SETUP_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTemplate(t);
              setExcluded(new Set());
            }}
            className="card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-in-300 dark:hover:border-in-600"
          >
            <span className="text-2xl" aria-hidden>
              {t.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-900 dark:text-white">
                {t.label}
              </span>
              <span className="block text-sm text-ink-700 dark:text-ink-500">
                {t.description}
              </span>
            </span>
            <span className="text-ink-500" aria-hidden>
              →
            </span>
          </button>
        ))}
        <button
          onClick={onClose}
          className="w-full py-2 text-center text-sm font-medium text-ink-600 hover:text-ink-800 dark:hover:text-ink-200"
        >
          Ik doe het liever zelf
        </button>
      </div>
    );
  }

  const included = template.pots.filter((p) => !excluded.has(p.name));
  const capped = included.slice(0, availableSlots);
  const cappedNames = new Set(capped.map((p) => p.name));
  const droppedByLimit = included.length - capped.length;

  function toggle(name: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function apply() {
    setError(null);
    if (capped.length === 0) {
      setError("Kies minstens één potje.");
      return;
    }
    setBusy(true);
    // Alleen de groepen die na capping nog gebruikt worden.
    const usedGroups = useGroups
      ? template!.groups.filter((g) => capped.some((p) => p.group === g))
      : [];
    const res = await onApply({ groups: usedGroups, pots: capped });
    setBusy(false);
    if (res.error) setError(res.error);
    else onClose();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setTemplate(null)}
          className="font-medium text-ink-700 hover:text-ink-900 dark:text-ink-500 dark:hover:text-white"
        >
          ← Ander type
        </button>
        <span className="text-ink-500">·</span>
        <span className="font-semibold text-ink-900 dark:text-white">
          {template.emoji} {template.label}
        </span>
      </div>

      <p className="text-sm text-ink-700 dark:text-ink-500">
        Deze potjes maken we aan. Vink af wat je niet wil.
      </p>

      <ul className="space-y-1.5">
        {template.pots.map((p) => {
          const on = !excluded.has(p.name);
          const overLimit = on && !cappedNames.has(p.name);
          return (
            <li key={p.name}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                  on
                    ? "border-ink-200 bg-ink-50 dark:border-ink-800/60 dark:bg-ink-900/40"
                    : "border-dashed border-ink-200 opacity-50 dark:border-ink-800/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(p.name)}
                  className="h-4 w-4 accent-teal-600"
                />
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-sm font-medium text-ink-900 dark:text-ink-100">
                  {p.name}
                </span>
                {useGroups && p.group && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700 dark:bg-ink-900 dark:text-ink-500">
                    {p.group}
                  </span>
                )}
                {overLimit && (
                  <span className="text-[11px] font-medium text-uit-700 dark:text-uit-400">
                    boven limiet
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {droppedByLimit > 0 && (
        <div className="rounded-lg border border-uit-300 bg-uit-100 px-3 py-2 text-xs text-uit-700 dark:border-uit-700/50 dark:bg-uit-700/20 dark:text-uit-300">
          Je plan laat nog {availableSlots} {availableSlots === 1 ? "potje" : "potjes"} toe.
          We maken de eerste {capped.length}; de rest kan na een upgrade.
        </div>
      )}
      {!useGroups && template.groups.length > 0 && (
        <p className="text-xs text-ink-600 dark:text-ink-600">
          Groepen (takken/afdelingen) zijn beschikbaar op Team. We maken de potjes
          nu zonder groep aan.
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
          Annuleren
        </button>
        <button type="button" onClick={apply} disabled={busy} className="btn-accent">
          {busy ? "Bezig…" : `Maak ${capped.length} ${capped.length === 1 ? "potje" : "potjes"}`}
        </button>
      </div>
    </div>
  );
}
