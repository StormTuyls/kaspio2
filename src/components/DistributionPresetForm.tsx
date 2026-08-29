import { useState } from "react";
import type { Pot } from "../types";

type Props = {
  pots: Pot[];
  initialShares: { potId: string; percent: number }[];
  onSave: (
    shares: { potId: string; percent: number }[],
  ) => Promise<{ error: string | null }>;
  onCancel: () => void;
};

/**
 * Stel de verdeel-preset in: per potje een percentage van het te verdelen geld.
 * De som mag niet boven 100%; wat overblijft blijft in de hoofdpot staan.
 */
export function DistributionPresetForm({
  pots,
  initialShares,
  onSave,
  onCancel,
}: Props) {
  // Percentage per potje als tekst (leeg = 0), zodat het veld leeg mag zijn.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const s of initialShares) {
      if (s.percent > 0) m[s.potId] = String(s.percent);
    }
    return m;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = pots.map((p) => ({
    pot: p,
    percent: clampPercent(values[p.id]),
  }));
  const total = parsed.reduce((a, r) => a + r.percent, 0);
  const remaining = Math.max(0, 100 - total);
  const over = total > 100.0001;

  async function submit() {
    if (over) {
      setError("De percentages samen mogen niet meer dan 100% zijn.");
      return;
    }
    setBusy(true);
    setError(null);
    const shares = parsed
      .filter((r) => r.percent > 0)
      .map((r) => ({ potId: r.pot.id, percent: r.percent }));
    const res = await onSave(shares);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onCancel();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted dark:text-ink-500">
        Kies per potje welk deel van het te verdelen geld het krijgt. Wat je niet
        toewijst blijft in de hoofdpot staan.
      </p>

      {pots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-sm text-ink-muted dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-500">
          Maak eerst een potje aan.
        </p>
      ) : (
        <ul className="space-y-2">
          {parsed.map(({ pot }) => (
            <li key={pot.id} className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: pot.color ?? "#1D9E75" }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800 dark:text-ink-200">
                {pot.name}
              </span>
              <div className="relative w-24 flex-shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.5"
                  value={values[pot.id] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [pot.id]: e.target.value }))
                  }
                  placeholder="0"
                  className="input pr-7 text-right font-num tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-light">
                  %
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2.5 text-sm dark:bg-ink-950/40">
        <span className="font-medium text-ink-800 dark:text-ink-300">
          Samen
        </span>
        <span
          className={`font-num font-bold tabular-nums ${
            over ? "text-fout-600 dark:text-fout-400" : "text-ink-900 dark:text-white"
          }`}
        >
          {formatPercent(total)} · {formatPercent(remaining)} in de hoofdpot
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary" disabled={busy}>
          Annuleren
        </button>
        <button
          onClick={submit}
          disabled={busy || over || pots.length === 0}
          className="btn-accent"
        >
          {busy ? "Bezig…" : "Bewaren"}
        </button>
      </div>
    </div>
  );
}

/** Parse een percentage-veld naar een getal in [0, 100]. Ongeldig = 0. */
function clampPercent(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

function formatPercent(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : String(rounded)}%`;
}
