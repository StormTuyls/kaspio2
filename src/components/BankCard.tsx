import { formatEuro } from "../storage";

type Props = {
  /** "Totaal saldo" (admin/lezer) of "Mijn saldo" (pot-owner). */
  label: string;
  /** Volledig accountsaldo: alle potjes + hoofdpot = het echte banksaldo. */
  total: number;
  /** Saldo van de hoofdpot: geld dat nog naar potjes verdeeld moet worden. */
  unallocated: number;
  potCount: number;
  groupCount: number;
  /** Aantal transacties zonder potje (de inbox). 0 = niks toe te wijzen. */
  unassignedCount?: number;
  /** Aanwezig (admin) → toont de "Verdeel volgens %"-knop bij een positieve hoofdpot. */
  onDistribute?: () => void;
  /** Aanwezig (admin) → link naar de toe-te-wijzen-inbox. */
  onOpenInbox?: () => void;
};

/**
 * Het saldo-overzicht bovenaan het dashboard: totaal op de rekening, en hoeveel
 * daarvan al in potjes zit tegenover wat nog in de hoofdpot wacht.
 *
 * De kaart staat altijd omgekeerd aan de pagina: donker navy op het lichte
 * dashboard, een tint lichter dan de achtergrond in dark mode. Zo blijft het
 * saldo in beide thema's de blikvanger, terwijl vorm, hoeken en schaduw
 * dezelfde zijn als bij de andere kaarten.
 *
 * De verdeelbalk staat er altijd, ook wanneer alles verdeeld is. Onverdeeld geld
 * mag blijven staan, maar het mag nooit onzichtbaar worden: zolang er iets in de
 * hoofdpot zit, zegt de kaart hoeveel en biedt ze de twee wegen eruit (verdelen
 * volgens percentages, of per transactie toewijzen).
 */
export function BankCard({
  label,
  total,
  unallocated,
  potCount,
  groupCount,
  unassignedCount = 0,
  onDistribute,
  onOpenInbox,
}: Props) {
  // Wat al in potjes zit. Bij een negatieve hoofdpot is er meer verdeeld dan er
  // binnenkwam; dan is het potjes-deel groter dan het totaal.
  const inPots = total - unallocated;
  const hasUnallocated = unallocated > 0.004;
  const overDistributed = unallocated < -0.004;
  // Breedte van het verdeelde deel, geklemd op [0,100] zodat een negatieve
  // hoofdpot of een negatief totaal de balk niet laat ontsporen.
  const span = Math.max(Math.abs(total), Math.abs(inPots), 0.01);
  const potsPct = Math.min(100, Math.max(0, (inPots / span) * 100));

  return (
    <div className="flex h-full flex-col rounded-2xl bg-navy-900 p-5 text-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_18px_-4px_rgba(15,23,42,0.18)] dark:bg-navy-700 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_18px_-4px_rgba(0,0,0,0.5)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-num text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-300 dark:text-navy-200">
          {label}
        </p>
        <p className="text-xs text-navy-300 dark:text-navy-200">
          {potCount} {potCount === 1 ? "potje" : "potjes"} · {groupCount}{" "}
          {groupCount === 1 ? "groep" : "groepen"}
        </p>
      </div>

      <p className="mt-1 font-num text-4xl font-extrabold tracking-tight tabular-nums">
        {formatEuro(total)}
      </p>

      {/* De verdeelbalk hangt onderaan (mt-auto), zodat de kaart even hoog kan
          zijn als de kolom ernaast zonder een gat onder de inhoud. */}
      <div className="mt-auto pt-5" />
      <div className="flex h-2 overflow-hidden rounded-full bg-navy-700 dark:bg-navy-800">
        <div className="bg-teal-500" style={{ width: `${potsPct}%` }} />
        <div className={hasUnallocated ? "flex-1 bg-amber-400" : "flex-1"} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="text-navy-300 dark:text-navy-200">
          <span className="font-num font-semibold tabular-nums">{formatEuro(inPots)}</span> in
          potjes
        </span>
        {hasUnallocated ? (
          <span className="font-semibold text-amber-300">
            <span className="font-num tabular-nums">{formatEuro(unallocated)}</span> nog te
            verdelen
          </span>
        ) : overDistributed ? (
          <span className="text-rose-300">
            Hoofdpot staat{" "}
            <span className="font-num font-semibold tabular-nums">{formatEuro(unallocated)}</span>
          </span>
        ) : (
          <span className="text-teal-300">Alles verdeeld</span>
        )}
      </div>

      {/* Acties: enkel zinvol wanneer er iets in de hoofdpot wacht. */}
      {(hasUnallocated || unassignedCount > 0) && (onDistribute || onOpenInbox) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {onDistribute && hasUnallocated && (
            <button
              onClick={onDistribute}
              className="rounded-xl bg-teal-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              Verdeel volgens %
            </button>
          )}
          {onOpenInbox && unassignedCount > 0 && (
            <button
              onClick={onOpenInbox}
              className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {unassignedCount} {unassignedCount === 1 ? "transactie" : "transacties"} toewijzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
