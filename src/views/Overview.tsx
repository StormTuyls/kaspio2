import { calcBalance, formatDate, formatEuro } from "../storage";
import type { Member, Pot, Transaction } from "../types";

type Props = {
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  currentUser: Member;
  organizationName: string;
  onSelect: (id: string) => void;
  onAddPot: () => void;
};

export function Overview({
  pots,
  allTransactions,
  members,
  currentUser,
  organizationName,
  onSelect,
  onAddPot,
}: Props) {
  const visibleIds = new Set(pots.map((p) => p.id));
  const txInScope = allTransactions.filter((t) => visibleIds.has(t.potId));
  const total = txInScope.reduce(
    (sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );
  const totalIn = txInScope.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = txInScope.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

  const memberById = new Map(members.map((m) => [m.id, m] as const));
  const isAdmin = currentUser.role === "admin";

  const recent = [...txInScope]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, 8);

  const potById = new Map(pots.map((p) => [p.id, p] as const));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
          {organizationName}
        </p>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
          {isAdmin ? "Dashboard" : "Mijn potjes"}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={isAdmin ? "Totaal saldo" : "Mijn saldo"}
          value={formatEuro(total)}
          accent="navy"
          big
        />
        <Stat
          label="Inkomend"
          value={formatEuro(totalIn)}
          accent="mint"
          delta={`${txInScope.filter((t) => t.direction === "in").length} transacties`}
        />
        <Stat
          label="Uitgaand"
          value={formatEuro(totalOut)}
          accent="rose"
          delta={`${txInScope.filter((t) => t.direction === "out").length} transacties`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">
              {isAdmin ? "Alle potjes" : "Mijn potjes"}
            </h2>
            {isAdmin && (
              <button onClick={onAddPot} className="btn-accent text-sm">
                + Nieuw potje
              </button>
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
          ) : (
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
      className="card group relative flex flex-col overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
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
          <h3 className="truncate text-base font-semibold text-navy-900 group-hover:text-azure-600 dark:text-navy-50 dark:group-hover:text-azure-300">
            {pot.name}
          </h3>
        </div>
        <span className="text-navy-300 transition group-hover:text-azure-500 dark:text-navy-500">
          →
        </span>
      </div>
      <div className="mb-4 flex items-center gap-2 text-sm text-navy-500 dark:text-navy-300">
        <Avatar name={owner?.name ?? "—"} size="sm" />
        <span className="truncate">{owner?.name ?? "Geen verantwoordelijke"}</span>
      </div>

      <div className="mb-3 text-2xl font-bold text-navy-900 dark:text-navy-50">
        {formatEuro(balance)}
      </div>

      {progress !== null && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-navy-400 dark:text-navy-300">
            <span>Doel: {formatEuro(pot.targetAmount!)}</span>
            <span className="font-semibold text-mint-600 dark:text-mint-400">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-navy-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint-500 to-mint-400 transition-all"
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
            <span className="font-semibold text-mint-600 dark:text-mint-400">
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
            const pot = potById.get(tx.potId);
            const positive = tx.direction === "in";
            return (
              <li key={tx.id} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    positive
                      ? "bg-mint-50 text-mint-600 dark:bg-mint-900/30 dark:text-mint-400"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
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
                      className={`whitespace-nowrap text-sm font-semibold ${
                        positive
                          ? "text-mint-600 dark:text-mint-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {formatEuro(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-xs text-navy-400 dark:text-navy-400">
                    <span className="truncate">{pot?.name ?? "—"}</span>
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
  accent: "navy" | "mint" | "rose";
  delta?: string;
  big?: boolean;
}) {
  const ring = {
    navy: "before:bg-navy-700 dark:before:bg-azure-400",
    mint: "before:bg-mint-500",
    rose: "before:bg-rose-500",
  }[accent];
  return (
    <div
      className={`card relative overflow-hidden p-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${ring}`}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
        {label}
      </p>
      <p
        className={`font-extrabold text-navy-900 dark:text-navy-50 ${big ? "text-3xl" : "text-2xl"}`}
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
