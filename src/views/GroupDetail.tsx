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
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-700 hover:text-ink-900 dark:text-ink-500 dark:hover:text-white"
        >
          ← Terug naar groepen
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {parent ? (
              <button
                type="button"
                onClick={() => onOpenGroup(parent.id)}
                className="font-num text-[11px] font-semibold text-in-600 hover:underline dark:text-in-400"
              >
                {parent.name} ›
              </button>
            ) : (
              <p className="font-num text-[11px] font-semibold text-in-600 dark:text-in-400">
                Groep
              </p>
            )}
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">
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
            <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 text-sm dark:border-ink-800/60 dark:bg-ink-950">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1 font-medium transition ${
                  period === p
                    ? "bg-in-600 text-white"
                    : "text-ink-700 hover:text-ink-900 dark:text-ink-500 dark:hover:text-white"
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
          <p className="mt-2 text-sm text-fout-600 dark:text-fout-400">{subError}</p>
        )}
      </div>

      {/* Stat-tegels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-ink-950 p-5 text-white dark:bg-ink-900">
          <p className="text-[11px] font-semibold text-ink-500">
            Saldo
          </p>
          <p className="mt-1 font-num text-2xl font-extrabold tabular-nums">
            {formatEuro(saldo)}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {groupPots.length} {groupPots.length === 1 ? "potje" : "potjes"}
          </p>
        </div>
        <div className="rounded-md border border-ink-200 bg-white p-5 dark:border-ink-800/60 dark:bg-ink-950">
          <p className="text-[11px] font-semibold text-ink-600 dark:text-ink-500">
            Inkomend · {PERIOD_LABELS[period].toLowerCase()}
          </p>
          <p className="mt-1 font-num text-2xl font-extrabold tabular-nums text-in-700 dark:text-in-400">
            {formatEuro(totalIn)}
          </p>
        </div>
        <div className="rounded-md border border-ink-200 bg-white p-5 dark:border-ink-800/60 dark:bg-ink-950">
          <p className="text-[11px] font-semibold text-ink-600 dark:text-ink-500">
            Uitgaand · {PERIOD_LABELS[period].toLowerCase()}
          </p>
          <p className="mt-1 font-num text-2xl font-extrabold tabular-nums text-uit-700 dark:text-uit-400">
            {formatEuro(totalOut)}
          </p>
        </div>
      </div>

      {/* Cashflow-grafiek (Pro+) over de groep */}
      {chartsEnabled(tier) && groupTx.length > 0 && (
        <div className="rounded-md border border-ink-200 bg-white p-3 sm:p-5 dark:border-ink-800/60 dark:bg-ink-950">
          <h2 className="mb-3 px-1 text-base font-bold text-ink-900 sm:px-0 dark:text-ink-100">
            Verloop saldo
          </h2>
          <BalanceChart transactions={groupTx} />
        </div>
      )}

      {/* Subgroepen, met hun eigen totaal. Samen zijn ze het saldo hierboven,
          samen met de potjes die rechtstreeks in deze groep hangen. */}
      {children.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-ink-600">
            Subgroepen
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((c) => {
              const cPots = potsInGroup(pots, groups, c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenGroup(c.id)}
                  className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-in-300 dark:hover:border-in-600/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink-900 dark:text-ink-100">
                      {c.name}
                    </span>
                    <span className="block text-xs text-ink-600 dark:text-ink-500">
                      {cPots.length} {cPots.length === 1 ? "potje" : "potjes"}
                    </span>
                  </span>
                  <span className="flex-shrink-0 font-num font-bold tabular-nums text-ink-900 dark:text-ink-100">
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
        <h2 className="mb-2 text-sm font-bold text-ink-600">
          {children.length > 0 ? "Alle potjes, subgroepen inbegrepen" : "Potjes in deze groep"}
        </h2>
        {groupPots.length === 0 ? (
          <div className="card border-dashed py-10 text-center text-sm text-ink-600 dark:text-ink-500">
            Nog geen potjes in deze groep.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groupPots.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPot(p.id)}
                className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-in-300 dark:hover:border-in-600/60"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-8 w-8 flex-shrink-0 rounded-lg"
                    style={{ backgroundColor: p.color ?? "#1D9E75" }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink-900 dark:text-ink-100">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-ink-600 dark:text-ink-500">
                      {ownerName(p)}
                    </span>
                  </span>
                </span>
                <span className="flex-shrink-0 font-num font-bold tabular-nums text-ink-900 dark:text-ink-100">
                  {formatEuro(calcBalance(allTransactions, p.id))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recente transacties over de groep */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-600">
          Recente transacties
        </h2>
        {inPeriod.length === 0 ? (
          <div className="card border-dashed py-10 text-center text-sm text-ink-600 dark:text-ink-500">
            Geen transacties in deze periode.
          </div>
        ) : (
          <div className="card divide-y divide-ink-200 dark:divide-ink-800/60">
            {inPeriod.slice(0, 50).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="block truncate font-medium text-ink-900 dark:text-ink-100">
                    {t.counterparty || t.memo || "Transactie"}
                  </span>
                  <span className="block truncate text-xs text-ink-600 dark:text-ink-500">
                    {formatDate(t.occurredOn)} · {potName(t.potId)}
                  </span>
                </div>
                <span
                  className={`flex-shrink-0 font-num font-bold tabular-nums ${
                    t.direction === "in"
                      ? "text-in-700 dark:text-in-400"
                      : "text-uit-700 dark:text-uit-400"
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
          <p className="mt-2 text-center text-xs text-ink-600">
            + {inPeriod.length - 50} meer in deze periode
          </p>
        )}
      </div>
    </div>
  );
}
