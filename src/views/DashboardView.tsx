import { useState, type ReactNode } from "react";
import { calcBalance, formatDate, formatEuro } from "../storage";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import type { SubTier } from "../supabase";
import { chartsEnabled } from "../data";
import { CashflowChart } from "../components/CashflowChart";
import { UpgradeHint } from "../components/UpgradeHint";

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

  // Periode voor de in/uit-totalen. Het saldo blijft altijd het volledige
  // lopende saldo; in/uit worden gescoped zodat die bedragen niet eindeloos
  // oplopen.
  const [flowPeriod, setFlowPeriod] = useState<FlowPeriod>("month");

  const visibleIds = new Set(pots.map((p) => p.id));
  const txInScope = allTransactions.filter((t) =>
    t.potId ? visibleIds.has(t.potId) : isAdmin,
  );
  // Saldo = alle transacties (het werkelijke bedrag op de rekening).
  const total = txInScope.reduce(
    (s, t) => s + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );
  const flowStart = flowWindowStart(flowPeriod);
  const flowTx = txInScope.filter((t) => t.occurredOn >= flowStart);
  const totalIn = flowTx
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = flowTx
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
    <div className="space-y-6 font-display">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-num text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
            {organizationName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
        </div>
        <PeriodTabs value={flowPeriod} onChange={setFlowPeriod} />
      </div>

      {/* Hoofd-statistieken */}
      <div className="grid gap-4 sm:grid-cols-3">
        <HeroBalance
          label={seesAll ? "Totaal saldo" : "Mijn saldo"}
          value={formatEuro(total)}
          potCount={pots.length}
          groupCount={groups.length}
        />
        <FlowStat label="Inkomend" sub={FLOW_LABELS[flowPeriod]} value={formatEuro(totalIn)} tone="in" />
        <FlowStat label="Uitgaand" sub={FLOW_LABELS[flowPeriod]} value={formatEuro(totalOut)} tone="out" />
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
          className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Icon className="h-5 w-5">
                <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </Icon>
            </span>
            <div>
              <p className="font-num text-sm font-bold tabular-nums text-amber-900 dark:text-amber-200">
                {formatEuro(unallocatedTotal)} nog toe te wijzen
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {unallocated.length}{" "}
                {unallocated.length === 1 ? "transactie" : "transacties"} zonder
                potje. Klik om toe te wijzen.
              </p>
            </div>
          </div>
          <span className="text-amber-600 transition group-hover:translate-x-0.5 dark:text-amber-400">
            →
          </span>
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
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-navy-50">
            Groepen &amp; potjes
          </h2>
          {pots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center text-sm text-slate-500 dark:border-navy-700 dark:bg-navy-900/30 dark:text-navy-300">
              Nog geen potjes. Maak er een aan op de Potjes-pagina.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((sec) => (
                <div
                  key={sec.id ?? "__none__"}
                  className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.1)] dark:border-navy-700/60 dark:bg-navy-900 dark:shadow-none"
                >
                  <button
                    onClick={() => onOpenGroup(sec.id)}
                    className="group mb-3 flex items-baseline justify-between gap-2 text-left"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-num text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 transition group-hover:text-indigo-600 dark:text-navy-300 dark:group-hover:text-indigo-300">
                        {sec.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-navy-800 dark:text-navy-300">
                        {sec.pots.length}
                      </span>
                    </span>
                    <span className="flex-shrink-0 font-num text-sm font-bold tabular-nums text-slate-900 dark:text-navy-50">
                      {formatEuro(groupBalance(sec.pots))}
                    </span>
                  </button>
                  <ul className="space-y-0.5">
                    {sec.pots.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => onSelect(p.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-navy-800"
                        >
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: p.color ?? "#4f46e5" }}
                          />
                          <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-navy-200">
                            {p.name}
                          </span>
                          <span className="flex-shrink-0 font-num tabular-nums text-slate-500 dark:text-navy-400">
                            {formatEuro(calcBalance(allTransactions, p.id))}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {sec.pots.length > 5 && (
                    <button
                      onClick={() => onOpenGroup(sec.id)}
                      className="mt-2 text-left text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      + {sec.pots.length - 5} meer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <ActivityFeed recent={recent} potById={potById} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Local presentational components (nieuwe iris/emerald-identiteit)    */
/* ------------------------------------------------------------------ */

type FlowPeriod = "day" | "week" | "month" | "year";

const FLOW_LABELS: Record<FlowPeriod, string> = {
  day: "vandaag",
  week: "deze week",
  month: "deze maand",
  year: "dit jaar",
};

const FLOW_TABS: { id: FlowPeriod; label: string }[] = [
  { id: "day", label: "Dag" },
  { id: "week", label: "Week" },
  { id: "month", label: "Maand" },
  { id: "year", label: "Jaar" },
];

/** Startdatum (YYYY-MM-DD) van de huidige periode, t.o.v. vandaag. */
function flowWindowStart(p: FlowPeriod): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (p === "day") return `${y}-${pad(m)}-${pad(d)}`;
  if (p === "month") return `${y}-${pad(m)}-01`;
  if (p === "year") return `${y}-01-01`;
  // week: maandag van deze week
  const b = new Date(now);
  b.setDate(b.getDate() - ((b.getDay() + 6) % 7));
  return `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}`;
}

function PeriodTabs({
  value,
  onChange,
}: {
  value: FlowPeriod;
  onChange: (p: FlowPeriod) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-navy-800">
      {FLOW_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
            value === t.id
              ? "bg-white text-indigo-700 shadow-sm dark:bg-navy-700 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-navy-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Icon({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function HeroBalance({
  label,
  value,
  potCount,
  groupCount,
}: {
  label: string;
  value: string;
  potCount: number;
  groupCount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white shadow-lg shadow-indigo-600/20">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(16,185,129,0.45) 0%, transparent 70%)",
        }}
      />
      <p className="relative font-num text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100">
        {label}
      </p>
      <p className="relative mt-1 font-num text-3xl font-extrabold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="relative mt-3 text-xs text-indigo-100">
        {potCount} {potCount === 1 ? "potje" : "potjes"} · {groupCount}{" "}
        {groupCount === 1 ? "groep" : "groepen"}
      </p>
    </div>
  );
}

function FlowStat({
  label,
  sub,
  value,
  tone,
}: {
  label: string;
  sub?: string;
  value: string;
  tone: "in" | "out";
}) {
  const positive = tone === "in";
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.1)] dark:border-navy-700/60 dark:bg-navy-900 dark:shadow-none">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-navy-300">
          {label}
          {sub && (
            <span className="ml-1.5 normal-case tracking-normal text-slate-400 dark:text-navy-400">
              · {sub}
            </span>
          )}
        </p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            positive
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          }`}
        >
          <Icon className="h-4 w-4">
            {positive ? (
              <path d="M12 19V5M5 12l7-7 7 7" />
            ) : (
              <path d="M12 5v14M19 12l-7 7-7-7" />
            )}
          </Icon>
        </span>
      </div>
      <p
        className={`font-num text-2xl font-extrabold tabular-nums ${
          positive
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-4 text-center dark:border-navy-700/60 dark:bg-navy-900">
      <span className="font-num text-2xl font-extrabold tabular-nums text-slate-900 dark:text-navy-50">
        {value}
      </span>
      <span className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-navy-300">
        {label}
      </span>
    </div>
  );
}

function ActivityFeed({
  recent,
  potById,
}: {
  recent: Transaction[];
  potById: Map<string, Pot>;
}) {
  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.1)] dark:border-navy-700/60 dark:bg-navy-900 dark:shadow-none">
      <h2 className="mb-4 font-num text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-navy-300">
        Recente activiteit
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-navy-400">Nog geen transacties.</p>
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
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5">
                    {positive ? (
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    ) : (
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    )}
                  </Icon>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-navy-50">
                      {tx.counterparty}
                    </span>
                    <span
                      className={`whitespace-nowrap font-num text-sm font-semibold tabular-nums ${
                        positive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {formatEuro(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-xs text-slate-400 dark:text-navy-400">
                    <span className="truncate">{potLabel}</span>
                    <span className="whitespace-nowrap font-num">{formatDate(tx.occurredOn)}</span>
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
