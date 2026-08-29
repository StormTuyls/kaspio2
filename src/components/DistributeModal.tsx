import { useMemo, useState } from "react";
import { POT_KLEUR_STANDAARD } from "../types";
import type { Pot } from "../types";
import { computeShares } from "../data";
import { formatEuro } from "../storage";

import { Foutmelding } from "./Foutmelding";
type Props = {
  pots: Pot[];
  /** De verdeel-preset: percentage per potje. Mag leeg zijn. */
  shares: { potId: string; percent: number }[];
  /** Saldo van de hoofdpot ("nog te verdelen"). */
  available: number;
  onDistribute: (
    allocations: { toPotId: string; amount: number }[],
  ) => Promise<{ error: string | null }>;
  /** Open het preset-scherm om de percentages in te stellen/wijzigen. */
  onManagePreset: () => void;
  onCancel: () => void;
  /**
   * Aantal onverdeelde INKOMSTEN. Alleen die worden verdeeld; een uitgave
   * zonder potje blijft in de inbox staan en moet apart toegewezen worden.
   */
  incomingCount?: number;
  /** Spring naar die inbox. Zonder callback tonen we alleen de uitleg. */
  onOpenInbox?: () => void;
};

/**
 * Verdeel geld uit de hoofdpot over de potjes. Eén lijst met bedragvelden, die
 * je zelf invult of in één klik laat vullen volgens de opgeslagen percentages.
 * Zo werken procentueel en handmatig door elkaar: vullen volgens %, daarna
 * eentje bijsturen, kan gewoon.
 *
 * Niet alles hoeft weg: wat je niet toewijst blijft in de hoofdpot staan en is
 * later opnieuw te verdelen.
 */
export function DistributeModal({
  pots,
  shares,
  available,
  onDistribute,
  onManagePreset,
  onCancel,
  incomingCount = 0,
  onOpenInbox,
}: Props) {
  const visibleShares = useMemo(
    () => shares.filter((s) => pots.some((p) => p.id === s.potId)),
    [shares, pots],
  );
  const hasPreset = visibleShares.length > 0;
  const percentByPot = useMemo(
    () => new Map(visibleShares.map((s) => [s.potId, s.percent])),
    [visibleShares],
  );

  // Bedrag per potje als tekst, zodat een veld leeg mag zijn. Met een preset
  // starten we ingevuld: dat is de "verdeel volgens %"-flow, in één blik te
  // controleren en nog steeds aanpasbaar.
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    hasPreset ? fillFromShares(available, visibleShares) : {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allocations = pots
    .map((p) => ({ potId: p.id, amount: parseAmount(amounts[p.id]) }))
    .filter((a) => a.amount > 0);
  const allocated = allocations.reduce((s, a) => s + a.amount, 0);
  const remaining = round2(available - allocated);
  const overAvailable = remaining < -0.004;

  function setAmount(potId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [potId]: value }));
  }

  /** Zet het restant in dit potje, zodat je exact op nul uitkomt. */
  function fillRest(potId: string) {
    const others = pots
      .filter((p) => p.id !== potId)
      .reduce((s, p) => s + parseAmount(amounts[p.id]), 0);
    const rest = round2(available - others);
    setAmount(potId, rest > 0 ? toInput(rest) : "");
  }

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

  if (pots.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted dark:text-ink-400">
          Maak eerst een potje aan om geld naartoe te verdelen.
        </p>
        <div className="flex justify-end">
          <button onClick={onCancel} className="btn-secondary">
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Verdelen wijst de onverdeelde transacties zélf toe (oudste eerst,
          splitsend waar nodig), dus de inbox loopt hiermee leeg. Even zeggen
          wat er gaat gebeuren, want de verdeling gaat over bedragen terwijl de
          inbox over losse transacties gaat. */}
      {incomingCount > 0 && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-800/60 dark:bg-ink-900/40">
          <p className="text-sm text-ink-800 dark:text-ink-200">
            {incomingCount === 1
              ? "De inkomst die nog toe te wijzen staat, wordt hiermee zelf over de gekozen potjes verdeeld en verdwijnt dus uit je inbox."
              : `De ${incomingCount} inkomsten die nog toe te wijzen staan, worden hiermee zelf over de gekozen potjes verdeeld, oudste eerst. Ze verdwijnen dus uit je inbox.`}{" "}
            Een bedrag dat net over twee potjes valt, wordt gesplitst. Uitgaven
            zonder potje blijven staan.
          </p>
          {onOpenInbox && (
            <button
              onClick={onOpenInbox}
              className="mt-2 text-xs font-semibold text-in-700 underline underline-offset-2 hover:no-underline dark:text-in-400"
            >
              Liever zelf per transactie
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted dark:text-ink-400">
          In de hoofdpot:{" "}
          <span className="font-num font-semibold tabular-nums text-ink-900 dark:text-white">
            {formatEuro(available)}
          </span>
        </p>
        {hasPreset && (
          <button
            onClick={() => setAmounts(fillFromShares(available, visibleShares))}
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-800 transition hover:bg-ink-100 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Vul volgens %
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {pots.map((pot) => {
          const percent = percentByPot.get(pot.id);
          return (
            <li key={pot.id} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: pot.color ?? POT_KLEUR_STANDAARD }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-800 dark:text-ink-200">
                {pot.name}
                {percent !== undefined && (
                  <span className="ml-1.5 font-num text-xs text-ink-light">
                    {formatPercent(percent)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => fillRest(pot.id)}
                title="Zet het restant in dit potje"
                className="rounded-md px-1.5 py-1 text-xs font-semibold text-in-700 transition hover:bg-in-100 dark:text-in-400 dark:hover:bg-in-700/30"
              >
                rest
              </button>
              <div className="relative w-32 flex-shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-light">
                  €
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amounts[pot.id] ?? ""}
                  onChange={(e) => setAmount(pot.id, e.target.value)}
                  placeholder="0,00"
                  aria-label={`Bedrag voor ${pot.name}`}
                  className="input py-1.5 pl-6 pr-2 text-right font-num tabular-nums"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-2.5 text-sm dark:bg-ink-900">
        <span className="text-ink-muted dark:text-ink-400">
          {overAvailable ? "Tekort in de hoofdpot" : "Blijft in de hoofdpot"}
        </span>
        <span
          className={`font-num font-semibold tabular-nums ${
            overAvailable
              ? "text-uit-700 dark:text-uit-400"
              : "text-ink-900 dark:text-white"
          }`}
        >
          {formatEuro(remaining)}
        </span>
      </div>

      {overAvailable && (
        <p className="text-xs text-uit-700 dark:text-uit-400">
          Je verdeelt meer dan er in de hoofdpot zit. Die komt dan onder nul te
          staan; je banksaldo verandert niet.
        </p>
      )}

      {error && (
        <Foutmelding>
          {error}
        </Foutmelding>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          onClick={onManagePreset}
          className="text-sm font-medium text-in-600 hover:underline dark:text-in-400"
        >
          {hasPreset ? "Percentages aanpassen" : "Percentages instellen"}
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

/** Vul de velden volgens de preset, met dezelfde centenlogica als de verdeling zelf. */
function fillFromShares(
  available: number,
  shares: { potId: string; percent: number }[],
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const a of computeShares(Math.max(0, available), shares)) {
    next[a.potId] = toInput(a.amount);
  }
  return next;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

function toInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatPercent(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : String(rounded)}%`;
}
