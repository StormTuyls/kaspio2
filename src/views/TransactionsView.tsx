// =============================================================================
// Transactiegeschiedenis , alle transacties van de organisatie op één pagina
// =============================================================================
// PotDetail toont de transacties van één potje. Deze pagina zet er één lijst
// over alle (zichtbare) potjes heen, met optionele filters op periode, groep
// en potje. De zichtbaarheid volgt `pots`: wat de gebruiker niet in de sidebar
// ziet, ziet die hier ook niet.
// =============================================================================

import { useMemo, useState } from "react";
import { formatDate, formatEuro } from "../storage";
import type { Pot, PotGroup, Transaction, TransactionDirection } from "../types";
import type { SubTier } from "../supabase";
import { chartsEnabled } from "../data";
import {
  PERIOD_OPTIONS,
  inPeriod,
  resolvePeriod,
  type PeriodPreset,
} from "../period";
import { exportTransactionHistoryPdf, exportTransactionsCsv } from "../csv";

/** Sentinel voor "de hoofdpot / nog niet toegewezen" in de potje-dropdown. */
const UNALLOCATED = "__unallocated__";
const ALL = "";

type DirectionFilter = "all" | TransactionDirection;

type Props = {
  orgName: string;
  /** Enkel de potjes die deze gebruiker mag zien. */
  pots: Pot[];
  groups: PotGroup[];
  /** Alle transacties; deze view filtert zelf op zichtbaarheid. */
  transactions: Transaction[];
  /** Licentie: de PDF-export is Pro+, net als bij een potje. */
  tier?: SubTier;
  onUpgrade?: () => void;
  /** Open een potje-detailpagina. */
  onSelectPot?: (potId: string) => void;
};

export function TransactionsView({
  orgName,
  pots,
  groups,
  transactions,
  tier = "free",
  onUpgrade,
  onSelectPot,
}: Props) {
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [groupId, setGroupId] = useState<string>(ALL);
  const [potId, setPotId] = useState<string>(ALL);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [search, setSearch] = useState("");

  const canExportPdf = chartsEnabled(tier);

  // new Date() is in app-context prima (niet in workflow-scripts).
  const period = useMemo(
    () => resolvePeriod(preset, new Date(), custom),
    [preset, custom],
  );

  const potById = useMemo(() => new Map(pots.map((p) => [p.id, p])), [pots]);
  const visiblePotIds = useMemo(() => new Set(pots.map((p) => p.id)), [pots]);

  /** Potjes in de gekozen groep; zonder groepfilter zijn dat er gewoon alle. */
  const potsInGroup = useMemo(
    () => (groupId === ALL ? pots : pots.filter((p) => p.groupId === groupId)),
    [pots, groupId],
  );

  // De transacties waar deze gebruiker überhaupt bij mag. Onverdeeld geld
  // (potId === null) hoort bij de hoofdpot en is voor iedereen zichtbaar.
  const scoped = useMemo(
    () =>
      transactions.filter((t) => t.potId === null || visiblePotIds.has(t.potId)),
    [transactions, visiblePotIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groupPotIds = new Set(potsInGroup.map((p) => p.id));

    return scoped
      .filter((t) => {
        if (!inPeriod(t.occurredOn, period)) return false;
        if (direction !== "all" && t.direction !== direction) return false;

        if (potId === UNALLOCATED) {
          if (t.potId !== null) return false;
        } else if (potId !== ALL) {
          if (t.potId !== potId) return false;
        } else if (groupId !== ALL) {
          // Groep zonder specifiek potje: alles in de potjes van die groep.
          if (t.potId === null || !groupPotIds.has(t.potId)) return false;
        }

        if (q) {
          const hit =
            t.counterparty.toLowerCase().includes(q) ||
            (t.memo ?? "").toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const d = b.occurredOn.localeCompare(a.occurredOn);
        return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
      });
  }, [scoped, period, direction, potId, groupId, potsInGroup, search]);

  // Totalen over de filter. 'pending' telt niet mee, net als in het saldo.
  const totals = useMemo(() => {
    const settled = filtered.filter((t) => t.status !== "pending");
    const tin = settled
      .filter((t) => t.direction === "in")
      .reduce((s, t) => s + t.amount, 0);
    const tout = settled
      .filter((t) => t.direction === "out")
      .reduce((s, t) => s + t.amount, 0);
    return { in: tin, out: tout, result: tin - tout, pending: filtered.length - settled.length };
  }, [filtered]);

  const hasFilters =
    preset !== "all" ||
    groupId !== ALL ||
    potId !== ALL ||
    direction !== "all" ||
    search.trim() !== "";

  function resetFilters() {
    setPreset("all");
    setCustom({ start: "", end: "" });
    setGroupId(ALL);
    setPotId(ALL);
    setDirection("all");
    setSearch("");
  }

  /** Beschrijft de actieve potje/groep-filter, voor de kop van de PDF. */
  function scopeLabel(): string {
    if (potId === UNALLOCATED) return "Potje: nog niet toegewezen";
    if (potId !== ALL) return `Potje: ${potById.get(potId)?.name ?? potId}`;
    if (groupId !== ALL) {
      const g = groups.find((x) => x.id === groupId);
      return `Groep: ${g?.name ?? groupId}`;
    }
    return "alle potjes";
  }

  function potName(id: string | null): string {
    if (id === null) return "Nog niet toegewezen";
    return potById.get(id)?.name ?? "Onbekend potje";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
            Transacties
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-300">
            De volledige geschiedenis van {orgName}, over alle potjes heen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportTransactionsCsv(filtered, pots, `${orgName}-transacties`)
            }
            disabled={filtered.length === 0}
            className="btn-secondary text-sm"
            title="Download de gefilterde lijst als CSV"
          >
            ⬇ CSV
          </button>
          {canExportPdf ? (
            <button
              onClick={() =>
                exportTransactionHistoryPdf({
                  orgName,
                  periodLabel: period.label,
                  scopeLabel: scopeLabel(),
                  transactions: filtered,
                  pots,
                })
              }
              disabled={filtered.length === 0}
              className="btn-secondary text-sm"
              title="Exporteer de gefilterde lijst als PDF (Pro)"
            >
              ⬇ PDF
            </button>
          ) : (
            <button
              onClick={onUpgrade}
              className="btn-secondary text-sm opacity-70"
              title="PDF-export is een Pro-feature"
            >
              ⬇ PDF (Pro)
            </button>
          )}
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
              Periode
            </span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PeriodPreset)}
              className="input"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
              Groep
            </span>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                // Een potje uit een andere groep zou de lijst leegmaken.
                setPotId(ALL);
              }}
              disabled={groups.length === 0}
              className="input disabled:opacity-60"
            >
              <option value={ALL}>Alle groepen</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
              Potje
            </span>
            <select
              value={potId}
              onChange={(e) => setPotId(e.target.value)}
              className="input"
            >
              <option value={ALL}>
                {groupId === ALL ? "Alle potjes" : "Alle potjes in de groep"}
              </option>
              {potsInGroup.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {groupId === ALL && (
                <option value={UNALLOCATED}>Nog niet toegewezen</option>
              )}
            </select>
          </label>
        </div>

        {preset === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
                Van
              </span>
              <input
                type="date"
                value={custom.start}
                onChange={(e) => setCustom({ ...custom, start: e.target.value })}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
                Tot en met
              </span>
              <input
                type="date"
                value={custom.end}
                onChange={(e) => setCustom({ ...custom, end: e.target.value })}
                className="input"
              />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 dark:text-navy-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op tegenpartij of memo…"
              className="input pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-navy-100 bg-white p-1 text-xs font-semibold sm:flex dark:border-navy-700 dark:bg-navy-800">
            {(["all", "in", "out"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  direction === d
                    ? "bg-navy-900 text-white dark:bg-white dark:text-navy-900"
                    : "text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
                }`}
              >
                {d === "all" ? "Alle" : d === "in" ? "Inkomend" : "Uitgaand"}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="btn-ghost text-sm">
              Wis filters
            </button>
          )}
        </div>
      </div>

      {/* ---- Totalen over de filter ---- */}
      <div className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Transacties
          </p>
          <p className="text-xl font-bold tabular-nums text-navy-900 dark:text-white">
            {filtered.length}
            {totals.pending > 0 && (
              <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                {totals.pending} wacht op goedkeuring
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Inkomend
          </p>
          <p className="text-xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
            {formatEuro(totals.in)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Uitgaand
          </p>
          <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatEuro(totals.out)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Resultaat
          </p>
          <p
            className={`text-xl font-bold tabular-nums ${
              totals.result < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-navy-900 dark:text-white"
            }`}
          >
            {totals.result >= 0 ? "+" : "−"}
            {formatEuro(Math.abs(totals.result))}
          </p>
        </div>
      </div>

      {/* ---- Lijst ---- */}
      {filtered.length === 0 ? (
        <div className="card border-dashed py-12 text-center">
          <p className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
            {scoped.length === 0 ? "Nog geen transacties" : "Geen resultaten"}
          </p>
          <p className="text-sm text-navy-500 dark:text-navy-300">
            {scoped.length === 0
              ? "Zodra er geld binnenkomt of vertrekt, zie je het hier."
              : "Geen transacties die overeenkomen met je filters."}
          </p>
          {hasFilters && scoped.length > 0 && (
            <button onClick={resetFilters} className="btn-secondary mt-4 text-sm">
              Wis filters
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-navy-100 sm:hidden dark:divide-navy-700/60">
            {filtered.map((tx) => (
              <li key={tx.id} className="px-4 py-3.5">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold text-navy-900 dark:text-navy-50">
                    {tx.counterparty}
                  </span>
                  <span
                    className={`whitespace-nowrap text-base font-bold tabular-nums ${
                      tx.direction === "in"
                        ? "text-teal-700 dark:text-teal-300"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {tx.direction === "in" ? "+" : "−"}
                    {formatEuro(tx.amount)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-500 dark:text-navy-300">
                  <span>{formatDate(tx.occurredOn)}</span>
                  <span aria-hidden>·</span>
                  <PotChip
                    pot={tx.potId ? potById.get(tx.potId) : undefined}
                    label={potName(tx.potId)}
                    onClick={tx.potId && onSelectPot ? () => onSelectPot(tx.potId!) : undefined}
                  />
                  {tx.status === "pending" && <PendingChip />}
                </div>
                {tx.memo && (
                  <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
                    {tx.memo}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <table className="hidden w-full text-sm sm:table">
            <thead className="bg-canvas text-xs font-semibold uppercase tracking-wider text-navy-400 dark:bg-navy-800/50 dark:text-navy-300">
              <tr>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3 text-left">Potje</th>
                <th className="px-4 py-3 text-left">Tegenpartij</th>
                <th className="px-4 py-3 text-left">Memo</th>
                <th className="px-4 py-3 text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 dark:divide-navy-700/60">
              {filtered.map((tx) => (
                <tr
                  key={tx.id}
                  className="transition hover:bg-canvas dark:hover:bg-navy-800/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-navy-500 dark:text-navy-300">
                    {formatDate(tx.occurredOn)}
                  </td>
                  <td className="px-4 py-3">
                    <PotChip
                      pot={tx.potId ? potById.get(tx.potId) : undefined}
                      label={potName(tx.potId)}
                      onClick={
                        tx.potId && onSelectPot ? () => onSelectPot(tx.potId!) : undefined
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-navy-900 dark:text-navy-50">
                    <span className="flex items-center gap-2">
                      {tx.counterparty}
                      {tx.status === "pending" && <PendingChip />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-500 dark:text-navy-400">
                    {tx.memo ?? "—"}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                      tx.direction === "in"
                        ? "text-teal-700 dark:text-teal-300"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {tx.direction === "in" ? "+" : "−"}
                    {formatEuro(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PotChip({
  pot,
  label,
  onClick,
}: {
  pot?: Pot;
  label: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        aria-hidden
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: pot?.color ?? "#94a3b8" }}
      />
      <span className="truncate">{label}</span>
    </>
  );
  const base =
    "inline-flex max-w-[14rem] items-center gap-1.5 text-navy-700 dark:text-navy-200";
  if (!onClick) {
    return <span className={base}>{content}</span>;
  }
  return (
    <button
      onClick={onClick}
      className={`${base} rounded-md hover:text-teal-700 hover:underline dark:hover:text-teal-300`}
      title={`Open ${label}`}
    >
      {content}
    </button>
  );
}

function PendingChip() {
  return (
    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      Wacht op goedkeuring
    </span>
  );
}
