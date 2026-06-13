import { calcBalance, formatEuro } from "../storage";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import type { SubTier } from "../supabase";
import { chartsEnabled } from "../data";
import { CashflowChart } from "../components/CashflowChart";
import { UpgradeHint } from "../components/UpgradeHint";
import { RecentActivity, Stat } from "./Overview";

type Props = {
  pots: Pot[];
  allTransactions: Transaction[];
  members: Member[];
  currentUser: Member;
  organizationName: string;
  groups?: PotGroup[];
  tier: SubTier;
  onUpgrade: () => void;
  onSelect: (potId: string) => void;
  /** Spring naar de Potjes-pagina, eventueel gefocust op een groep. */
  onOpenGroup: (groupId: string | null) => void;
  /** Open de "Nog toe te wijzen" inbox (admin). */
  onOpenInbox?: () => void;
};

export function DashboardView({
  pots,
  allTransactions,
  members,
  currentUser,
  organizationName,
  groups = [],
  tier,
  onUpgrade,
  onSelect,
  onOpenGroup,
  onOpenInbox,
}: Props) {
  const isAdmin = currentUser.role === "admin";
  const isReader = currentUser.role === "reader";
  const seesAll = isAdmin || isReader;

  const visibleIds = new Set(pots.map((p) => p.id));
  const txInScope = allTransactions.filter((t) =>
    t.potId ? visibleIds.has(t.potId) : isAdmin,
  );
  const total = txInScope.reduce(
    (s, t) => s + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );
  const totalIn = txInScope
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = txInScope
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);

  const unallocated = allTransactions.filter((t) => t.potId === null);
  const unallocatedTotal = unallocated.reduce(
    (s, t) => s + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );

  const potById = new Map(pots.map((p) => [p.id, p] as const));
  const recent = [...txInScope]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, 8);

  const groupBalance = (gp: Pot[]) =>
    gp.reduce((s, p) => s + calcBalance(allTransactions, p.id), 0);

  // Groep-secties (+ ongegroepeerd als laatste) voor de mini-kaarten.
  const sections: { id: string | null; name: string; pots: Pot[] }[] = [
    ...groups
      .map((g) => ({
        id: g.id as string | null,
        name: g.name,
        pots: pots.filter((p) => p.groupId === g.id),
      }))
      .filter((s) => s.pots.length > 0),
  ];
  const ungrouped = pots.filter(
    (p) => !p.groupId || !groups.some((g) => g.id === p.groupId),
  );
  if (ungrouped.length > 0) {
    sections.push({ id: null, name: "Overige potjes", pots: ungrouped });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          {organizationName}
        </p>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
          Dashboard
        </h1>
      </div>

      {/* Stat-kaarten */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={seesAll ? "Totaal saldo" : "Mijn saldo"}
          value={formatEuro(total)}
          accent="teal-bold"
          big
        />
        <Stat label="Totaal inkomend" value={formatEuro(totalIn)} accent="teal" />
        <Stat label="Totaal uitgaand" value={formatEuro(totalOut)} accent="amber" />
      </div>

      {/* Tellers */}
      <div className="grid grid-cols-3 gap-4">
        <CountStat label="Potjes" value={pots.length} />
        <CountStat label="Groepen" value={groups.length} />
        <CountStat label={members.length === 1 ? "Lid" : "Leden"} value={members.length} />
      </div>

      {/* Onverdeeld geld */}
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

      {txInScope.length > 0 &&
        (chartsEnabled(tier) ? (
          <CashflowChart transactions={txInScope} />
        ) : (
          <UpgradeHint
            title="Cashflow-grafiek"
            description="Zie inkomsten en uitgaven per maand met het Pro-plan."
            onUpgrade={onUpgrade}
          />
        ))}

      {/* Groepen met hun potjes */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">
            Groepen &amp; potjes
          </h2>
          {pots.length === 0 ? (
            <div className="card border-dashed py-12 text-center text-sm text-navy-500 dark:text-navy-300">
              Nog geen potjes. Maak er een aan op de Potjes-pagina.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((sec) => (
                <div key={sec.id ?? "__none__"} className="card flex flex-col p-4">
                  <button
                    onClick={() => onOpenGroup(sec.id)}
                    className="group mb-3 flex items-baseline justify-between gap-2 text-left"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm font-bold uppercase tracking-wider text-navy-600 transition group-hover:text-teal-700 dark:text-navy-200 dark:group-hover:text-teal-300">
                        {sec.name}
                      </span>
                      <span className="rounded-full bg-navy-100 px-1.5 text-[11px] font-semibold text-navy-500 dark:bg-navy-800 dark:text-navy-300">
                        {sec.pots.length}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-sm font-bold tabular-nums text-navy-900 dark:text-navy-50">
                      {formatEuro(groupBalance(sec.pots))}
                    </span>
                  </button>
                  <ul className="space-y-1">
                    {sec.pots.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => onSelect(p.id)}
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition hover:bg-canvas dark:hover:bg-navy-800"
                        >
                          <span
                            aria-hidden
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: p.color ?? "#1D9E75" }}
                          />
                          <span className="min-w-0 flex-1 truncate text-navy-700 dark:text-navy-200">
                            {p.name}
                          </span>
                          <span className="flex-shrink-0 tabular-nums text-navy-500 dark:text-navy-400">
                            {formatEuro(calcBalance(allTransactions, p.id))}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {sec.pots.length > 5 && (
                    <button
                      onClick={() => onOpenGroup(sec.id)}
                      className="mt-2 text-left text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                    >
                      + {sec.pots.length - 5} meer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <RecentActivity recent={recent} potById={potById} />
      </div>
    </div>
  );
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card flex flex-col items-center justify-center p-4 text-center">
      <span className="text-2xl font-extrabold tabular-nums text-navy-900 dark:text-navy-50">
        {value}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
        {label}
      </span>
    </div>
  );
}
