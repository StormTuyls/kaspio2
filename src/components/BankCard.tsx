import { formatEuro } from "../storage";

type Props = {
  /** "Totaal saldo" (admin/lezer) of "Mijn saldo" (pot-owner). */
  label: string;
  /** Volledig accountsaldo: alle potjes + onverdeeld = het echte banksaldo. */
  total: number;
  /** Onverdeeld geld dat nog naar potjes moet ("nog te verdelen"). */
  unallocated: number;
  potCount: number;
  groupCount: number;
  /** Aanwezig (admin) → toont de "Verdeel volgens %"-knop wanneer er te verdelen is. */
  onDistribute?: () => void;
};

/**
 * Het totaalsaldo als een bankkaart. Toont het volledige banksaldo, met apart
 * het "nog te verdelen" (onverdeelde) deel en, voor admins, de knop om dat in
 * één klik volgens de vaste percentages over de potjes te verdelen.
 */
export function BankCard({
  label,
  total,
  unallocated,
  potCount,
  groupCount,
  onDistribute,
}: Props) {
  const hasUndistributed = unallocated > 0.004;
  const showDistribute = Boolean(onDistribute) && hasUndistributed;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-800 to-navy-950 p-6 text-white shadow-lg shadow-navy-900/25 sm:p-7">
      {/* Zachte merk-gloed rechtsboven */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(29,158,117,0.55) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="font-num text-[11px] font-semibold uppercase tracking-[0.2em] text-navy-200">
            {label}
          </p>
          <p className="mt-1.5 font-num text-4xl font-extrabold tracking-tight tabular-nums sm:text-[2.75rem]">
            {formatEuro(total)}
          </p>
        </div>
        <span className="font-display text-sm font-bold tracking-tight text-navy-100">
          Kaspio
        </span>
      </div>

      {/* "Chip" + potjes/groepen-telling */}
      <div className="relative mt-5 flex items-center gap-3">
        <span
          aria-hidden
          className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 shadow-inner"
        />
        <p className="text-xs text-navy-200">
          {potCount} {potCount === 1 ? "potje" : "potjes"} · {groupCount}{" "}
          {groupCount === 1 ? "groep" : "groepen"}
        </p>
      </div>

      {/* Nog te verdelen + verdeel-actie */}
      {hasUndistributed && (
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <div>
            <p className="font-num text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-200">
              Nog te verdelen
            </p>
            <p className="font-num text-lg font-bold tabular-nums text-white">
              {formatEuro(unallocated)}
            </p>
          </div>
          {showDistribute && (
            <button
              onClick={onDistribute}
              className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              Verdeel volgens %
            </button>
          )}
        </div>
      )}
    </div>
  );
}
