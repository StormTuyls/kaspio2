import { useMemo, useState } from "react";
import type { Pot } from "../types";
import { computeShares } from "../data";
import { formatEuro } from "../storage";

type Props = {
  pots: Pot[];
  /** De verdeel-preset: percentage per potje. */
  shares: { potId: string; percent: number }[];
  /** Saldo van de hoofdpot ("nog te verdelen"). */
  available: number;
  onDistribute: (
    allocations: { toPotId: string; amount: number }[],
  ) => Promise<{ error: string | null }>;
  /** Open het preset-scherm om de percentages in te stellen/wijzigen. */
  onManagePreset: () => void;
  onCancel: () => void;
};

/**
 * Verdeel het geld uit de hoofdpot in één klik volgens de opgeslagen percentages.
 * Toont een voorbeeld (potje → % → bedrag) voor het bevestigen.
 */
export function DistributeModal({
  pots,
  shares,
  available,
  onDistribute,
  onManagePreset,
  onCancel,
}: Props) {
  const defaultAmount = Math.max(0, Math.round(available * 100) / 100);
  const [amountStr, setAmountStr] = useState(
    defaultAmount > 0 ? String(defaultAmount) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const potById = useMemo(() => new Map(pots.map((p) => [p.id, p])), [pots]);
  const amount = parseAmount(amountStr);

  // Enkel percentages van potjes die de user ziet, tellen mee.
  const visibleShares = shares.filter((s) => potById.has(s.potId));
  const allocations = computeShares(amount, visibleShares);
  const allocated = allocations.reduce((a, x) => a + x.amount, 0);
  const remaining = Math.round((amount - allocated) * 100) / 100;
  const overAvailable = amount > available + 0.004;

  const hasPreset = visibleShares.length > 0;

  async function submit() {
    if (allocations.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await onDistribute(
      allocations.map((a) => ({ toPotId: a.potId, amount: a.amount })),
    );
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onCancel();
  }

  if (!hasPreset) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted dark:text-navy-300">
          Je hebt nog geen verdeling ingesteld. Kies eerst per potje welk
          percentage van het geld in de hoofdpot het krijgt.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">
            Annuleren
          </button>
          <button onClick={onManagePreset} className="btn-accent">
            Verdeling instellen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Bedrag om te verdelen
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-light">
            €
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="input pl-7 font-num tabular-nums"
          />
        </div>
        <span className="mt-1 block text-xs text-ink-light">
          Nog te verdelen in de hoofdpot: {formatEuro(Math.max(0, available))}
        </span>
      </label>

      {overAvailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          Dit is meer dan er te verdelen staat. De hoofdpot komt dan tijdelijk
          onder nul; het banktotaal verandert niet.
        </div>
      )}

      {/* Voorbeeld van de verdeling */}
      <div className="rounded-xl border border-navy-100 dark:border-navy-700">
        <ul className="divide-y divide-navy-100 dark:divide-navy-700">
          {allocations.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-light">
              Vul een bedrag in om de verdeling te zien.
            </li>
          ) : (
            allocations.map((a) => {
              const pot = potById.get(a.potId);
              const share = visibleShares.find((s) => s.potId === a.potId);
              return (
                <li
                  key={a.potId}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: pot?.color ?? "#1D9E75" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-navy-800 dark:text-navy-100">
                    {pot?.name ?? "Potje"}
                  </span>
                  <span className="font-num text-xs tabular-nums text-ink-light">
                    {share ? `${formatPercent(share.percent)}` : ""}
                  </span>
                  <span className="w-24 flex-shrink-0 text-right font-num text-sm font-semibold tabular-nums text-navy-900 dark:text-white">
                    {formatEuro(a.amount)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
        {allocations.length > 0 && (
          <div className="flex items-center justify-between border-t border-navy-100 px-4 py-2.5 text-sm dark:border-navy-700">
            <span className="text-ink-muted dark:text-navy-300">
              Blijft in de hoofdpot
            </span>
            <span className="font-num font-semibold tabular-nums text-navy-700 dark:text-navy-200">
              {formatEuro(remaining)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          onClick={onManagePreset}
          className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
        >
          Verdeling aanpassen
        </button>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary" disabled={busy}>
            Annuleren
          </button>
          <button
            onClick={submit}
            disabled={busy || allocations.length === 0}
            className="btn-accent"
          >
            {busy ? "Bezig…" : `Verdeel ${formatEuro(allocated)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseAmount(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatPercent(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : String(rounded)}%`;
}
