import { useMemo, useState } from "react";
import {
  calcBalance,
  formatDate,
  formatEuro,
  groupBalance,
  potsInGroup,
  subGroups,
} from "../storage";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import type { SubTier } from "../supabase";
import { chartsEnabled } from "../data";
import { BalanceChart } from "../components/BalanceChart";

type Props = {
  group: PotGroup;
  /** Alle groepen van de org, nodig om de subgroepen van deze groep te vinden. */
  groups: PotGroup[];
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  tier?: SubTier;
  onBack: () => void;
  onSelectPot: (potId: string) => void;
  /** Spring naar een andere groep (hoofdgroep of subgroep). */
  onOpenGroup: (groupId: string) => void;
  isAdmin?: boolean;
  /** Open het potjesformulier met deze groep al ingevuld. */
  onAddPot?: (groupId: string) => void;
  /** false = potjeslimiet bereikt, dan wordt "+ Potje" een upgrade-aanzet. */
  canAddPot?: boolean;
  onUpgrade?: () => void;
  /** Alleen bij een hoofdgroep: een subgroep hieronder aanmaken. */
  onCreateSubgroup?: (
    name: string,
    parentId: string,
  ) => Promise<{ error: string | null }>;
};

type Period = "month" | "year" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  month: "Deze maand",
  year: "Dit jaar",
  all: "Alles",
};

function periodStart(period: Period, now: Date): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (period === "month") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  if (period === "year") return `${now.getFullYear()}-01-01`;
  return null;
}

export function GroupDetail({
  group,
  groups,
  pots,
  allTransactions,
  members,
  tier = "free",
  onBack,
  onSelectPot,
  onOpenGroup,
  isAdmin = false,
  onAddPot,
  canAddPot = true,
  onUpgrade,
  onCreateSubgroup,
}: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [subName, setSubName] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const parent = group.parentId
    ? (groups.find((g) => g.id === group.parentId) ?? null)
    : null;
  const children = useMemo(
    () => subGroups(groups, group.id),
    [groups, group.id],
  );

  // Diep: bij een hoofdgroep tellen de potjes uit haar subgroepen mee. Anders
  // zou het saldo hier lager staan dan op de groepenpagina, waar het wel het
  // bloktotaal toont.
  const groupPots = useMemo(
    () => potsInGroup(pots, groups, group.id, true),
    [pots, groups, group.id],
  );
  const potIds = useMemo(() => new Set(groupPots.map((p) => p.id)), [groupPots]);

  // Saldo = som van de potjes (all-time, goedgekeurd). calcBalance negeert pending.
  const saldo = groupPots.reduce((s, p) => s + calcBalance(allTransactions, p.id), 0);

  // Goedgekeurde transacties binnen de groep.
  const groupTx = useMemo(
    () =>
      allTransactions
        .filter((t) => t.potId && potIds.has(t.potId) && t.status !== "pending")
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    [allTransactions, potIds],
  );

  const start = periodStart(period, new Date());
  const inPeriod = start ? groupTx.filter((t) => t.occurredOn >= start) : groupTx;
  const totalIn = inPeriod
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = inPeriod
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);

  async function submitSub() {
    const naam = (subName ?? "").trim();
    if (!naam) {
      setSubError("Geef de subgroep een naam.");
      return;
    }
    setSubError(null);
    setSubBusy(true);
    const res = await onCreateSubgroup!(naam, group.id);
    setSubBusy(false);
    if (res.error) {
      setSubError(res.error);
      return;
    }
    setSubName(null);
  }

  const potName = (id: string | null) =>
    groupPots.find((p) => p.id === id)?.name ?? "—";
  const ownerName = (pot: Pot) =>
    members.find((m) => m.id === pot.ownerId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
        >
          ← Terug naar groepen
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {parent ? (
              <button
                type="button"
                onClick={() => onOpenGroup(parent.id)}
                className="font-num text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-600 hover:underline dark:text-teal-300"
              >
                {parent.name} ›
              </button>
            ) : (
              <p className="font-num text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-600 dark:text-teal-300">
                Groep
              </p>
            )}
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
              {group.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && onAddPot && (
              <button
                onClick={canAddPot ? () => onAddPot(group.id) : onUpgrade}
                className="btn-secondary text-sm"
              >
                {canAddPot ? "+ Potje" : "Upgrade voor meer potjes"}
              </button>
            )}
            {/* Alleen bij een hoofdgroep: een subgroep kan zelf geen
                subgroepen hebben. */}
            {isAdmin && onCreateSubgroup && !parent && subName === null && (
              <button
                onClick={() => {
                  setSubName("");
                  setSubError(null);
                }}
                className="btn-secondary text-sm"
              >
                + Subgroep
              </button>
            )}
            <div className="inline-flex rounded-xl border border-navy-100 bg-white p-1 text-sm dark:border-navy-700/60 dark:bg-navy-900">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1 font-medium transition ${
                  period === p
                    ? "bg-teal-500 text-white"
                    : "text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
            </div>
          </div>
        </div>

        {subName !== null && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              autoFocus
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSub();
                if (e.key === "Escape") {
                  setSubName(null);
                  setSubError(null);
                }
              }}
              placeholder={`Subgroep onder ${group.name}`}
              maxLength={80}
              disabled={subBusy}
              className="input min-w-0 flex-1 sm:max-w-sm"
            />
            <button
              onClick={() => {
                setSubName(null);
                setSubError(null);
              }}
              className="btn-secondary text-sm"
              disabled={subBusy}
            >
              Annuleren
            </button>
            <button onClick={submitSub} className="btn-accent text-sm" disabled={subBusy}>
              {subBusy ? "Bezig…" : "Aanmaken"}
            </button>
          </div>
        )}
        {subError && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{subError}</p>
        )}
      </div>

      {/* Stat-tegels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-navy-900 p-5 text-white dark:bg-navy-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-300">
            Saldo
          </p>
          <p className="mt-1 font-num text-2xl font-extrabold tabular-nums">
            {formatEuro(saldo)}
          </p>
          <p className="mt-1 text-xs text-navy-300">
            {groupPots.length} {groupPots.length === 1 ? "potje" : "potjes"}
          </p>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5 dark:border-navy-700/60 dark:bg-navy-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Inkomend · {PERIOD_LABELS[period].toLowerCase()}
          </p>
          <p className="mt-1 font-num text-2xl font-extrabold tabular-nums text-teal-700 dark:text-teal-300">
            {formatEuro(totalIn)}
          </p>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5 dark:border-navy-700/60 dark:bg-navy-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
            Uitgaand · {PERIOD_LABELS[period].toLowerCase()}
          </p>
          <p className="mt-1 font-num text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
            {formatEuro(totalOut)}
          </p>
        </div>
      </div>

      {/* Cashflow-grafiek (Pro+) over de groep */}
      {chartsEnabled(tier) && groupTx.length > 0 && (
        <div className="rounded-2xl border border-navy-100 bg-white p-3 sm:p-5 dark:border-navy-700/60 dark:bg-navy-900">
          <h2 className="mb-3 px-1 text-base font-bold text-navy-900 sm:px-0 dark:text-navy-50">
            Verloop saldo
          </h2>
          <BalanceChart transactions={groupTx} />
        </div>
      )}

      {/* Subgroepen, met hun eigen totaal. Samen zijn ze het saldo hierboven,
          samen met de potjes die rechtstreeks in deze groep hangen. */}
      {children.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
            Subgroepen
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((c) => {
              const cPots = potsInGroup(pots, groups, c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenGroup(c.id)}
                  className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-teal-300 dark:hover:border-teal-500/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy-900 dark:text-navy-50">
                      {c.name}
                    </span>
                    <span className="block text-xs text-navy-400 dark:text-navy-300">
                      {cPots.length} {cPots.length === 1 ? "potje" : "potjes"}
                    </span>
                  </span>
                  <span className="flex-shrink-0 font-num font-bold tabular-nums text-navy-900 dark:text-navy-50">
                    {formatEuro(groupBalance(allTransactions, pots, groups, c.id))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Potjes in de groep */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          {children.length > 0 ? "Alle potjes, subgroepen inbegrepen" : "Potjes in deze groep"}
        </h2>
        {groupPots.length === 0 ? (
          <div className="card border-dashed py-10 text-center text-sm text-navy-400 dark:text-navy-300">
            Nog geen potjes in deze groep.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groupPots.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPot(p.id)}
                className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-teal-300 dark:hover:border-teal-500/60"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-8 w-8 flex-shrink-0 rounded-lg"
                    style={{ backgroundColor: p.color ?? "#1D9E75" }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy-900 dark:text-navy-50">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-navy-400 dark:text-navy-300">
                      {ownerName(p)}
                    </span>
                  </span>
                </span>
                <span className="flex-shrink-0 font-num font-bold tabular-nums text-navy-900 dark:text-navy-50">
                  {formatEuro(calcBalance(allTransactions, p.id))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recente transacties over de groep */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Recente transacties
        </h2>
        {inPeriod.length === 0 ? (
          <div className="card border-dashed py-10 text-center text-sm text-navy-400 dark:text-navy-300">
            Geen transacties in deze periode.
          </div>
        ) : (
          <div className="card divide-y divide-navy-100 dark:divide-navy-700/60">
            {inPeriod.slice(0, 50).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="block truncate font-medium text-navy-900 dark:text-navy-50">
                    {t.counterparty || t.memo || "Transactie"}
                  </span>
                  <span className="block truncate text-xs text-navy-400 dark:text-navy-300">
                    {formatDate(t.occurredOn)} · {potName(t.potId)}
                  </span>
                </div>
                <span
                  className={`flex-shrink-0 font-num font-bold tabular-nums ${
                    t.direction === "in"
                      ? "text-teal-700 dark:text-teal-300"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {t.direction === "in" ? "+" : "−"}
                  {formatEuro(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
        {inPeriod.length > 50 && (
          <p className="mt-2 text-center text-xs text-navy-400">
            + {inPeriod.length - 50} meer in deze periode
          </p>
        )}
      </div>
    </div>
  );
}
