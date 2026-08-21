import { useEffect, useState } from "react";
import { calcBalance, calcSpent, formatDate, formatEuro } from "../storage";
import { potProgress } from "../potProgress";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import { UpgradeHint } from "../components/UpgradeHint";

type PotsViewProps = {
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  currentUser: Member;
  /** Potgroepen (takken/ploegen) voor visuele groepering. */
  groups?: PotGroup[];
  /** Groep waar de sidebar naartoe wil scrollen (id, of null = ongegroepeerde). */
  focusGroupId?: string | null;
  /** Aangeroepen nadat er gescrolld is, zodat het focus-signaal gereset wordt. */
  onFocusConsumed?: () => void;
  onSelect: (id: string) => void;
  onAddPot: () => void;
  /** Org-brede transactie toevoegen (admin). */
  onAddTransaction?: () => void;
  /** Geld verplaatsen tussen potjes (admin, minstens 2 potjes). */
  onTransfer?: () => void;
  /** Open de opzet-wizard (sjablonen) vanuit de lege staat. */
  onUseTemplate?: () => void;
  /** CSV-import (Pro). Alleen aanwezig als de licentie het toelaat. */
  onImport?: () => void;
  /** Licentie: kan er nog een potje bij? Anders upgrade-prompt. */
  canAddPot?: boolean;
  potLimit?: number;
  onUpgrade?: () => void;
};

export const NONE_KEY = "__none__";

/** De Potjes-pagina: alle potjes als kaarten, gegroepeerd + inklapbaar. */
export function PotsView({
  pots,
  allTransactions,
  members,
  currentUser,
  groups = [],
  focusGroupId,
  onFocusConsumed,
  onSelect,
  onAddPot,
  onAddTransaction,
  onTransfer,
  onUseTemplate,
  onImport,
  canAddPot = true,
  potLimit,
  onUpgrade,
}: PotsViewProps) {
  const isAdmin = currentUser.role === "admin";
  const isReader = currentUser.role === "reader";
  const seesAll = isAdmin || isReader;

  const memberById = new Map(members.map((m) => [m.id, m] as const));

  // Groepeer potjes: secties per groep (in groeps-volgorde), rest ongegroepeerd.
  const groupSections = groups
    .map((g) => ({ group: g, pots: pots.filter((p) => p.groupId === g.id) }))
    .filter((s) => s.pots.length > 0);
  const ungrouped = pots.filter(
    (p) => !p.groupId || !groups.some((g) => g.id === p.groupId),
  );
  const hasGroups = groupSections.length > 0;

  const groupBalance = (groupPots: Pot[]) =>
    groupPots.reduce((sum, p) => sum + calcBalance(allTransactions, p.id), 0);

  // Inklapbare groep-secties: ingeklapte ids in een Set.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Navigatie vanuit sidebar/dashboard: scroll naar de groep + klap 'm open.
  useEffect(() => {
    if (focusGroupId === undefined) return;
    const key = focusGroupId === null ? NONE_KEY : focusGroupId;
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    const el = document.getElementById(`grp-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    onFocusConsumed?.();
  }, [focusGroupId, onFocusConsumed]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
          {seesAll ? "Alle potjes" : "Mijn potjes"}
        </h1>
        {isAdmin && (
          <div className="flex gap-2">
            {onImport && (
              <button onClick={onImport} className="btn-secondary text-sm">
                Importeer CSV
              </button>
            )}
            {onAddTransaction && (
              <button onClick={onAddTransaction} className="btn-secondary text-sm">
                + Transactie
              </button>
            )}
            {onTransfer && (
              <button onClick={onTransfer} className="btn-secondary text-sm">
                Verplaats
              </button>
            )}
            {canAddPot ? (
              <button onClick={onAddPot} className="btn-accent text-sm">
                + Nieuw potje
              </button>
            ) : (
              <button onClick={onUpgrade} className="btn-accent text-sm">
                Upgrade voor meer potjes
              </button>
            )}
          </div>
        )}
      </div>

      {isAdmin && !canAddPot && potLimit !== undefined && (
        <UpgradeHint
          compact
          title={`Je hebt het maximum van ${potLimit} potjes bereikt`}
          description="Upgrade naar Pro voor onbeperkt potjes."
          onUpgrade={onUpgrade}
        />
      )}

      {pots.length === 0 ? (
        <div className="card border-dashed py-14 text-center">
          <p className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
            {isAdmin ? "Nog geen potjes" : "Je hebt nog geen potjes"}
          </p>
          <p className="mb-5 text-sm text-navy-500 dark:text-navy-300">
            {isAdmin
              ? "Maak je eerste potje aan om geldstromen te organiseren."
              : "Vraag de admin om je een potje toe te wijzen."}
          </p>
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {onUseTemplate && (
                <button onClick={onUseTemplate} className="btn-accent">
                  Kies een sjabloon
                </button>
              )}
              <button
                onClick={onAddPot}
                className={onUseTemplate ? "btn-secondary" : "btn-accent"}
              >
                + Eerste potje aanmaken
              </button>
            </div>
          )}
        </div>
      ) : !hasGroups ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pots.map((pot) => (
            <PotCard
              key={pot.id}
              pot={pot}
              owner={memberById.get(pot.ownerId)}
              transactions={allTransactions}
              onSelect={() => onSelect(pot.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[
            ...groupSections.map((s) => ({
              key: s.group.id,
              label: s.group.name,
              secPots: s.pots,
              muted: false,
            })),
            ...(ungrouped.length > 0
              ? [{ key: NONE_KEY, label: "Overige potjes", secPots: ungrouped, muted: true }]
              : []),
          ].map(({ key, label, secPots, muted }) => {
            const isCollapsed = collapsed.has(key);
            return (
              <section
                key={key}
                id={`grp-${key}`}
                className="scroll-mt-24 rounded-2xl border border-navy-100 bg-white/40 p-2 dark:border-navy-700/60 dark:bg-navy-900/30"
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-navy-50 dark:hover:bg-navy-800/50"
                  aria-expanded={!isCollapsed}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`flex-shrink-0 text-navy-400 transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <h3
                      className={`truncate text-sm font-bold uppercase tracking-wider ${
                        muted
                          ? "text-navy-400 dark:text-navy-400"
                          : "text-navy-600 dark:text-navy-200"
                      }`}
                    >
                      {label}
                    </h3>
                    <span className="rounded-full bg-navy-100 px-1.5 text-[11px] font-semibold text-navy-500 dark:bg-navy-800 dark:text-navy-300">
                      {secPots.length}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-navy-700 dark:text-navy-200">
                    {formatEuro(groupBalance(secPots))}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="mt-2 grid gap-3 px-0.5 pb-0.5 sm:grid-cols-2 xl:grid-cols-3">
                    {secPots.map((pot) => (
                      <PotCard
                        key={pot.id}
                        pot={pot}
                        owner={memberById.get(pot.ownerId)}
                        transactions={allTransactions}
                        onSelect={() => onSelect(pot.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PotCard({
  pot,
  owner,
  transactions,
  onSelect,
}: {
  pot: Pot;
  owner: Member | undefined;
  transactions: Transaction[];
  onSelect: () => void;
}) {
  const balance = calcBalance(transactions, pot.id);
  const potTx = transactions.filter((t) => t.potId === pot.id);
  const lastIncoming = [...potTx]
    .filter((t) => t.direction === "in")
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))[0];
  const progress = potProgress(pot.targetAmount, pot.targetKind, {
    balance,
    totalOut: calcSpent(transactions, pot.id),
  });

  const dotColor = pot.color ?? "#1D9E75";

  return (
    <button
      onClick={onSelect}
      className="card group relative flex flex-col overflow-hidden p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg dark:hover:border-teal-800"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: dotColor }}
      />
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <h3 className="truncate text-base font-semibold text-navy-900 transition group-hover:text-teal-700 dark:text-navy-50 dark:group-hover:text-teal-300">
            {pot.name}
          </h3>
        </div>
        <span className="text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600 dark:text-navy-500 dark:group-hover:text-teal-400">
          →
        </span>
      </div>
      <div className="mb-4 flex items-center gap-2 text-sm text-navy-500 dark:text-navy-300">
        <Avatar name={owner?.name ?? "—"} size="sm" />
        <span className="truncate">{owner?.name ?? "Geen verantwoordelijke"}</span>
      </div>

      <div className="mb-3 text-2xl font-bold tabular-nums text-navy-900 dark:text-navy-50">
        {formatEuro(balance)}
      </div>

      {progress !== null && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-navy-400 dark:text-navy-300">
            <span>{progress.label}</span>
            <span
              className={`font-semibold ${
                progress.over
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-teal-600 dark:text-teal-400"
              }`}
            >
              {progress.pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-navy-700">
            <div
              className={`h-full rounded-full transition-all ${
                progress.over
                  ? "bg-gradient-to-r from-rose-400 to-rose-600"
                  : "bg-gradient-to-r from-teal-400 to-teal-600"
              }`}
              style={{ width: `${progress.barPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-navy-100 pt-3 text-xs dark:border-navy-700/60">
        {lastIncoming ? (
          <>
            <span className="text-navy-500 dark:text-navy-300">
              Laatste in: {formatDate(lastIncoming.occurredOn)}
            </span>
            <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">
              +{formatEuro(lastIncoming.amount)}
            </span>
          </>
        ) : (
          <span className="text-navy-400 dark:text-navy-400">Nog geen inkomsten</span>
        )}
      </div>
    </button>
  );
}

export function RecentActivity({
  recent,
  potById,
}: {
  recent: Transaction[];
  potById: Map<string, Pot>;
}) {
  return (
    <aside className="card flex h-fit flex-col p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
        Recente activiteit
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-navy-400 dark:text-navy-400">Nog geen transacties.</p>
      ) : (
        <ul className="space-y-3">
          {recent.map((tx) => {
            const pot = tx.potId ? potById.get(tx.potId) : undefined;
            const potLabel = tx.potId ? pot?.name ?? "—" : "Nog toe te wijzen";
            const positive = tx.direction === "in";
            return (
              <li key={tx.id} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    positive
                      ? "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {positive ? (
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    ) : (
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    )}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">
                      {tx.counterparty}
                    </span>
                    <span
                      className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                        positive
                          ? "text-teal-700 dark:text-teal-300"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {formatEuro(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-xs text-navy-400 dark:text-navy-400">
                    <span className="truncate">{potLabel}</span>
                    <span className="whitespace-nowrap">{formatDate(tx.occurredOn)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export function Stat({
  label,
  value,
  accent,
  delta,
  big,
}: {
  label: string;
  value: string;
  accent: "teal-bold" | "teal" | "amber" | "rose";
  delta?: string;
  big?: boolean;
}) {
  const ring = {
    "teal-bold":
      "before:bg-gradient-to-b before:from-teal-500 before:to-teal-700",
    teal: "before:bg-teal-400",
    amber: "before:bg-amber-500",
    rose: "before:bg-rose-500",
  }[accent];
  const isHero = accent === "teal-bold";
  return (
    <div
      className={`card relative overflow-hidden p-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${ring} ${
        isHero
          ? "ring-1 ring-teal-100/60 dark:ring-teal-900/40"
          : ""
      }`}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
        {label}
      </p>
      <p
        className={`font-extrabold ${
          isHero
            ? "text-teal-700 dark:text-teal-300"
            : "text-navy-900 dark:text-navy-50"
        } ${big ? "text-3xl" : "text-2xl"}`}
      >
        {value}
      </p>
      {delta && <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">{delta}</p>}
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.trim().slice(0, 1).toUpperCase();
  const cls = size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-sm";
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-700 dark:bg-navy-800 dark:text-navy-100 ${cls}`}
    >
      {initials}
    </span>
  );
}
