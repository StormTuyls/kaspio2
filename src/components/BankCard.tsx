import { formatEuro } from "../storage";

type Props = {
  /** "Totaal saldo" (admin/lezer) of "Mijn saldo" (pot-owner). */
  label: string;
  /** Volledig accountsaldo: alle potjes + hoofdpot = het echte banksaldo. */
  total: number;
  /**
   * Zijn de bedragen nog onderweg? Dan is 0 geen saldo maar "nog niks binnen".
   * Een bedrag van € 0,00 tonen dat een tel later naar het echte saldo springt
   * leest als een fout in de boekhouding, dus tonen we zolang een streepje.
   */
  loading?: boolean;
  /** Saldo van de hoofdpot: geld dat nog naar potjes verdeeld moet worden. */
  unallocated: number;
  potCount: number;
  groupCount: number;
  /** Aantal transacties zonder potje (de inbox). 0 = niks toe te wijzen. */
  unassignedCount?: number;
  /** Aanwezig (admin) → toont de "Verdelen"-knop bij een positieve hoofdpot. */
  onDistribute?: () => void;
  /** Aanwezig (admin) → link naar de toe-te-wijzen-inbox. */
  onOpenInbox?: () => void;
  /** Aanwezig (admin) → geld toevoegen aan de hoofdpot. Staat er altijd: juist
   *  bij een lege hoofdpot is dit de actie die je zoekt. */
  onAddMoney?: () => void;
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
 * over de potjes, of een losse transactie aan een potje toewijzen).
 */
export function BankCard({
  label,
  total,
  loading,
  unallocated,
  potCount,
  groupCount,
  unassignedCount = 0,
  onDistribute,
  onOpenInbox,
  onAddMoney,
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
    <div className="flex h-full flex-col rounded-md bg-ink-950 p-5 text-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_18px_-4px_rgba(15,23,42,0.18)] dark:bg-ink-800 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_18px_-4px_rgba(0,0,0,0.5)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-num text-[11px] font-semibold text-ink-500 dark:text-ink-300">
          {label}
        </p>
        <p className="text-xs text-ink-500 dark:text-ink-300">
          {potCount} {potCount === 1 ? "potje" : "potjes"} · {groupCount}{" "}
          {groupCount === 1 ? "groep" : "groepen"}
        </p>
      </div>

      <p className="mt-1 font-num text-[clamp(1.75rem,1.4rem+1.4vw,2.25rem)] font-bold tabular-nums [letter-spacing:-0.02em]">
        {loading ? "\u2014" : formatEuro(total)}
      </p>

      {/* De verdeelbalk hangt onderaan (mt-auto), zodat de kaart even hoog kan
          zijn als de kolom ernaast zonder een gat onder de inhoud. */}
      <div className="mt-auto pt-5" />
      <div className="flex h-2 overflow-hidden rounded-full bg-ink-800 dark:bg-ink-900">
        <div className="bg-in-600" style={{ width: `${potsPct}%` }} />
        <div className={hasUnallocated ? "flex-1 bg-uit-300" : "flex-1"} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="text-ink-500 dark:text-ink-300">
          <span className="font-num font-semibold tabular-nums">
            {loading ? "\u2014" : formatEuro(inPots)}
          </span>{" "}
          in potjes
        </span>
        {loading ? null : hasUnallocated ? (
          <span className="font-semibold text-uit-400">
            <span className="font-num tabular-nums">{formatEuro(unallocated)}</span> nog te
            verdelen
          </span>
        ) : overDistributed ? (
          <span className="text-fout-400">
            Hoofdpot staat{" "}
            <span className="font-num font-semibold tabular-nums">{formatEuro(unallocated)}</span>
          </span>
        ) : (
          <span className="text-in-400">Alles verdeeld</span>
        )}
      </div>

      {/* Acties op de hoofdpot. Verdelen en toewijzen hebben alleen zin met geld
          of openstaande transacties; geld toevoegen kan altijd. */}
      {(onAddMoney || ((hasUnallocated || unassignedCount > 0) && (onDistribute || onOpenInbox))) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {onDistribute && hasUnallocated && (
            <button
              onClick={onDistribute}
              className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-100"
            >
              Verdelen
            </button>
          )}
          {onOpenInbox && unassignedCount > 0 && (
            <button
              onClick={onOpenInbox}
              className="rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {unassignedCount} {unassignedCount === 1 ? "transactie" : "transacties"} toewijzen
            </button>
          )}
          {onAddMoney && (
            <button
              onClick={onAddMoney}
              className={
                hasUnallocated
                  ? "rounded-md px-3.5 py-2 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
                  : "rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-100"
              }
            >
              Geld toevoegen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
