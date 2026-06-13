import { calcBalance, formatDate, formatEuro } from "../storage";
import type { Member, Pot, PotGroup, Transaction } from "../types";

type Props = {
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  currentUser: Member;
  organizationName: string;
  /** Potgroepen (takken/ploegen) voor visuele groepering. */
  groups?: PotGroup[];
  onSelect: (id: string) => void;
  onAddPot: () => void;
  /** Org-brede transactie toevoegen (admin). */
  onAddTransaction?: () => void;
  /** Open de "Nog toe te wijzen" inbox (admin). */
  onOpenInbox?: () => void;
};

export function Overview({
  pots,
  allTransactions,
  members,
  currentUser,
  organizationName,
  groups = [],
  onSelect,
  onAddPot,
  onAddTransaction,
  onOpenInbox,
}: Props) {
  const isAdmin = currentUser.role === "admin";
  const isReader = currentUser.role === "reader";
  // Admins en lezers zien het volledige org-overzicht; pot-owners hun eigen potjes.
  const seesAll = isAdmin || isReader;
  const visibleIds = new Set(pots.map((p) => p.id));
  // Alleen admins tellen onverdeeld geld (potId null) mee: zij kunnen het zien en
  // toewijzen (RLS verbergt het voor lezers en pot-owners).
  const txInScope = allTransactions.filter((t) =>
    t.potId ? visibleIds.has(t.potId) : isAdmin,
  );
  const total = txInScope.reduce(
    (sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );
  const totalIn = txInScope.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = txInScope.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

  const unallocated = allTransactions.filter((t) => t.potId === null);
  const unallocatedTotal = unallocated.reduce(
    (sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );

  const memberById = new Map(members.map((m) => [m.id, m] as const));

  const recent = [...txInScope]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, 8);

  const potById = new Map(pots.map((p) => [p.id, p] as const));

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          {organizationName}
        </p>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
          {isAdmin ? "Dashboard" : seesAll ? "Alle potjes" : "Mijn potjes"}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={seesAll ? "Totaal saldo" : "Mijn saldo"}
          value={formatEuro(total)}
          accent="teal-bold"
          big
        />
        <Stat
          label="Inkomend"
          value={formatEuro(totalIn)}
          accent="teal"
          delta={`${txInScope.filter((t) => t.direction === "in").length} transacties`}
        />
        <Stat
          label="Uitgaand"
          value={formatEuro(totalOut)}
          accent="amber"
          delta={`${txInScope.filter((t) => t.direction === "out").length} transacties`}
        />
      </div>

      {isAdmin && onOpenInbox && unallocated.length > 0 && (
        <button
          onClick={onOpenInbox}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:border-amber-300 dark:border-amber-900/50 dark:bg-amber-900/20"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-base dark:bg-amber-900/40">
              📥
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {formatEuro(unallocatedTotal)} nog toe te wijzen
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {unallocated.length}{" "}
                {unallocated.length === 1 ? "transactie" : "transacties"} zonder
                potje. Klik om toe te wijzen.
              </p>
            </div>
          </div>
          <span className="text-amber-600 dark:text-amber-400">→</span>
        </button>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">
              {seesAll ? "Alle potjes" : "Mijn potjes"}
            </h2>
            {isAdmin && (
              <div className="flex gap-2">
                {onAddTransaction && (
                  <button onClick={onAddTransaction} className="btn-secondary text-sm">
                    + Transactie
                  </button>
                )}
                <button onClick={onAddPot} className="btn-accent text-sm">
                  + Nieuw potje
                </button>
              </div>
            )}
          </div>

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
                <button onClick={onAddPot} className="btn-accent">
                  + Eerste potje aanmaken
                </button>
              )}
            </div>
          ) : !hasGroups ? (
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="space-y-6">
              {groupSections.map(({ group, pots: groupPots }) => (
                <section key={group.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
                      {group.name}
                    </h3>
                    <span className="text-sm font-semibold tabular-nums text-navy-700 dark:text-navy-200">
                      {formatEuro(groupBalance(groupPots))}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groupPots.map((pot) => (
                      <PotCard
                        key={pot.id}
                        pot={pot}
                        owner={memberById.get(pot.ownerId)}
                        transactions={allTransactions}
                        onSelect={() => onSelect(pot.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {ungrouped.length > 0 && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-navy-400">
                      Overige potjes
                    </h3>
                    <span className="text-sm font-semibold tabular-nums text-navy-700 dark:text-navy-200">
                      {formatEuro(groupBalance(ungrouped))}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ungrouped.map((pot) => (
                      <PotCard
                        key={pot.id}
                        pot={pot}
                        owner={memberById.get(pot.ownerId)}
                        transactions={allTransactions}
                        onSelect={() => onSelect(pot.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <RecentActivity recent={recent} potById={potById} />
      </div>
    </div>
  );
}

function PotCard({
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
  const progress =
    pot.targetAmount && pot.targetAmount > 0
      ? Math.min(100, Math.max(0, (balance / pot.targetAmount) * 100))
      : null;

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
            <span>Doel: {formatEuro(pot.targetAmount!)}</span>
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-navy-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all"
              style={{ width: `${progress}%` }}
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

function RecentActivity({
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

function Stat({
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
