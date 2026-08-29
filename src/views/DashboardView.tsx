import { useState, type ReactNode } from "react";
import {
  calcBalance,
  formatDate,
  formatEuro,
  potsInGroup,
  rootGroups,
  ungroupedPots,
} from "../storage";
import type { Member, Pot, PotGroup, Transaction } from "../types";
import type { SubTier } from "../supabase";
import { chartsEnabled, isReservationDue, type RecurringPlan } from "../data";
import { CashflowChart } from "../components/CashflowChart";
import { UpgradeHint } from "../components/UpgradeHint";
import { BankCard } from "../components/BankCard";

type Props = {
  pots: Pot[];
  allTransactions: Transaction[];
  /**
   * Staan de potjes en transacties er nog niet? Dan zijn de bedragen nog geen
   * bedragen. Zonder dit toont het dashboard een tel lang € 0,00 en springt
   * daarna naar het echte saldo, en dat leest als een fout.
   */
  loading?: boolean;
  members: Member[];
  currentUser: Member;
  organizationName: string;
  groups?: PotGroup[];
  tier: SubTier;
  onUpgrade: () => void;
  onSelect: (potId: string) => void;
  /** Spring naar de Potjes-pagina, eventueel gefocust op een groep. */
  onOpenGroup: (groupId: string | null) => void;
  /** Spring naar een tab (Potjes/Groepen/Leden) vanuit de teller-tegels. */
  onNavigate?: (tab: "potjes" | "groepen" | "leden") => void;
  /** Open de "Nog toe te wijzen" inbox (admin). */
  onOpenInbox?: () => void;
  /** Verdeel het geld uit de hoofdpot volgens de percentages (admin). */
  onDistribute?: () => void;
  /** Terugkerende boekingen (stortingen/domiciliëringen). */
  recurringPlans?: RecurringPlan[];
  /** Boek een openstaande maandelijkse storting (admin). */
  onBookStorting?: (plan: RecurringPlan) => void | Promise<void>;
  /** Open het beheer van terugkerende boekingen (admin). */
  onManageRecurring?: () => void;
  /** Geld toevoegen aan de hoofdpot (admin). Staat op de saldokaart. */
  onAddMoney?: () => void;
  /** Genereer een financieel rapport (PDF). Alleen aanwezig bij Pro+ admin. */
  onExportReport?: () => void;
  /** Goedkeuren/afwijzen van transacties die op goedkeuring wachten (admin). */
  onApprove?: (txnId: string) => void;
  onReject?: (txnId: string) => void;
};

export function DashboardView({
  pots,
  allTransactions,
  loading,
  currentUser,
  organizationName,
  groups = [],
  tier,
  onUpgrade,
  onSelect,
  onOpenGroup,
  onOpenInbox,
  onDistribute,
  recurringPlans = [],
  onBookStorting,
  onManageRecurring,
  onAddMoney,
  onExportReport,
  onApprove,
  onReject,
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
  // Goedgekeurde transacties tellen mee in saldo/totalen; 'pending' niet.
  const approvedInScope = txInScope.filter((t) => t.status !== "pending");
  // Saldo = alle goedgekeurde transacties (het werkelijke bedrag op de rekening).
  const total = approvedInScope.reduce(
    (s, t) => s + (t.direction === "in" ? t.amount : -t.amount),
    0,
  );
  const flowStart = flowWindowStart(flowPeriod);
  // Overboekingen tussen potjes (transferGroup) tellen niet mee in in/uit:
  // er komt netto niks je rekening in of uit, enkel de verdeling verschuift.
  const flowTx = approvedInScope.filter(
    (t) => t.occurredOn >= flowStart && !t.transferGroup,
  );
  // Transacties die op goedkeuring wachten (admin keurt ze goed/af).
  const pendingApprovals = allTransactions.filter((t) => t.status === "pending");
  const totalIn = flowTx
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = flowTx
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);

  // Hoofdpot: alles zonder potje.
  const hoofdpotTx = allTransactions.filter((t) => t.potId === null);
  // De kaart zegt "nog te verdelen" en biedt de verdeelknop aan, dus hier hoort
  // het VERDEELBARE bedrag te staan, niet het saldo. Geld waarover nog beslist
  // moet worden telt wel mee in het saldo maar kan niet verdeeld worden; dat
  // beloven zou de knop laten falen.
  const hoofdpotTotal = hoofdpotTx
    .filter((t) => t.confirmed)
    .reduce((s, t) => s + (t.direction === "in" ? t.amount : -t.amount), 0);
  // Nog te beslissen: dat is de inbox. Verdeel-regels horen er niet bij.
  const unallocated = hoofdpotTx.filter((t) => !t.transferGroup && !t.confirmed);

  const potById = new Map(pots.map((p) => [p.id, p] as const));

  // Openstaande maandelijkse stortingen ("te bevestigen"). Alleen admins boeken.
  const todayIso = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  // Enkel de handmatige regels; automatische boekt de app zelf (zie App.tsx).
  const dueStortingen = isAdmin
    ? recurringPlans.filter((p) => !p.auto_book && isReservationDue(p, todayIso))
    : [];

  const recent = [...txInScope]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, 8);

  const sumBalance = (gp: Pot[]) =>
    gp.reduce((s, p) => s + calcBalance(allTransactions, p.id), 0);

  // Groep-secties (+ ongegroepeerd als laatste) voor de mini-kaarten. Alleen
  // hoofdgroepen, met de potjes van hun subgroepen erin geteld: dit is een
  // overzichtsscherm, geen boekhoudscherm. Wie de blokken apart wil ziet ze op
  // de groepenpagina.
  const sections: { id: string | null; name: string; pots: Pot[] }[] = [
    ...rootGroups(groups)
      .map((g) => ({
        id: g.id as string | null,
        name: g.name,
        pots: potsInGroup(pots, groups, g.id, true),
      }))
      .filter((s) => s.pots.length > 0),
  ];
  const ungrouped = ungroupedPots(pots, groups);
  if (ungrouped.length > 0) {
    sections.push({ id: null, name: "Overige potjes", pots: ungrouped });
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] text-ink-600 dark:text-ink-400">
            {organizationName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">
            Dashboard
          </h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {onManageRecurring && (
            <button onClick={onManageRecurring} className="btn-secondary text-sm">
              Terugkerend
            </button>
          )}
          {onExportReport && (
            <button onClick={onExportReport} className="btn-secondary text-sm">
              Rapport (PDF)
            </button>
          )}
        </div>
      </div>

      {/* Hoofd-statistieken: de bankkaart + in/uit-stromen */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <BankCard
            label={seesAll ? "Totaal saldo" : "Mijn saldo"}
            loading={loading}
            total={total}
            unallocated={hoofdpotTotal}
            potCount={pots.length}
            groupCount={groups.length}
            unassignedCount={isAdmin ? unallocated.length : 0}
            onDistribute={isAdmin ? onDistribute : undefined}
            onOpenInbox={isAdmin ? onOpenInbox : undefined}
            onAddMoney={isAdmin ? onAddMoney : undefined}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[0.8125rem] font-medium text-ink-600 dark:text-ink-400">
              Geldstroom
            </h2>
            <PeriodTabs value={flowPeriod} onChange={setFlowPeriod} />
          </div>
          <FlowStat
            label="Inkomend"
            sub={FLOW_LABELS[flowPeriod]}
            value={loading ? "\u2014" : formatEuro(totalIn)}
            tone="in"
          />
          <FlowStat
            label="Uitgaand"
            sub={FLOW_LABELS[flowPeriod]}
            value={loading ? "\u2014" : formatEuro(totalOut)}
            tone="out"
          />
        </div>
      </div>


      {/* Te bevestigen: openstaande maandelijkse stortingen */}
      {dueStortingen.length > 0 && onBookStorting && (
        <div className="rounded-md border border-in-300 bg-in-100/70 p-4 dark:border-in-700/50 dark:bg-in-700/15">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight text-in-700 dark:text-in-300">
            Te bevestigen
            <span className="rounded-full bg-in-100 px-2 py-0.5 font-num text-xs font-bold text-in-700 dark:bg-in-700/40 dark:text-in-400">
              {dueStortingen.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {dueStortingen.map((plan) => {
              const potName = potById.get(plan.pot_id)?.name ?? "potje";
              return (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-in-100 bg-white px-3.5 py-2.5 dark:border-in-700/40 dark:bg-ink-950"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                      {plan.kind === "domiciliering"
                        ? `Zet ${plan.counterparty || "de domiciliëring"} klaar in ${potName}`
                        : `Storting in ${potName}`}
                    </p>
                    <p className="font-num text-xs text-ink-600 dark:text-ink-500">
                      {plan.counterparty || "Maandelijkse storting"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-num text-sm font-bold tabular-nums text-in-700 dark:text-in-400">
                      {formatEuro(plan.amount)}
                    </span>
                    <button
                      onClick={() => onBookStorting(plan)}
                      className="rounded-lg bg-in-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-in-600"
                    >
                      Boek
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Wacht op goedkeuring (admin) */}
      {isAdmin && pendingApprovals.length > 0 && (
        <div className="rounded-md border border-uit-300 bg-white p-5 dark:border-uit-700/40 dark:bg-ink-950">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight text-ink-900 dark:text-ink-100">
            Wacht op goedkeuring
            <span className="rounded-full bg-uit-100 px-2 py-0.5 font-num text-xs font-bold text-uit-700 dark:bg-uit-700/40 dark:text-uit-400">
              {pendingApprovals.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {pendingApprovals.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50/60 px-3 py-2.5 dark:border-ink-800/60 dark:bg-ink-900/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                    {t.counterparty || "Uitgave"}
                    <span className="ml-2 font-normal text-ink-600">
                      {t.potId ? potById.get(t.potId)?.name ?? "—" : "Nog toe te wijzen"}
                    </span>
                  </div>
                  <div className="font-num text-xs text-ink-600">
                    {formatDate(t.occurredOn)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-num text-sm font-semibold tabular-nums text-fout-600 dark:text-fout-400">
                    −{formatEuro(t.amount)}
                  </span>
                  <button
                    onClick={() => onApprove?.(t.id)}
                    className="rounded-lg bg-in-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-in-600"
                  >
                    Goedkeuren
                  </button>
                  <button
                    onClick={() => onReject?.(t.id)}
                    className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-semibold text-fout-600 transition hover:bg-fout-100 dark:border-ink-800"
                  >
                    Afwijzen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
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
        <div className="min-w-0 space-y-3 lg:col-span-2">
          <h2 className="text-lg font-bold tracking-tight text-ink-900 dark:text-ink-100">
            Groepen &amp; potjes
          </h2>
          {pots.length === 0 ? (
            <div className="rounded-md border border-dashed border-ink-300 bg-white/60 py-12 text-center text-sm text-ink-700 dark:border-ink-800 dark:bg-ink-950/30 dark:text-ink-500">
              Nog geen potjes. Maak er een aan op de Potjes-pagina.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((sec) => (
                <div
                  key={sec.id ?? "__none__"}
                  className="flex flex-col rounded-md border border-ink-300/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.1)] dark:border-ink-800/60 dark:bg-ink-950 dark:shadow-none"
                >
                  <button
                    onClick={() => onOpenGroup(sec.id)}
                    className="group mb-3 flex items-baseline justify-between gap-2 text-left"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-num text-[11px] font-bold text-ink-700 transition group-hover:text-ink-700 dark:text-ink-500 dark:group-hover:text-ink-700">
                        {sec.name}
                      </span>
                      <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-semibold text-ink-700 dark:bg-ink-900 dark:text-ink-500">
                        {sec.pots.length}
                      </span>
                    </span>
                    <span className="flex-shrink-0 font-num text-sm font-bold tabular-nums text-ink-900 dark:text-ink-100">
                      {loading ? "\u2014" : formatEuro(sumBalance(sec.pots))}
                    </span>
                  </button>
                  <ul className="space-y-0.5">
                    {sec.pots.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => onSelect(p.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-ink-50 dark:hover:bg-ink-900"
                        >
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: p.color ?? "#4f46e5" }}
                          />
                          <span className="min-w-0 flex-1 truncate text-ink-800 dark:text-ink-300">
                            {p.name}
                          </span>
                          <span className="flex-shrink-0 font-num tabular-nums text-ink-700 dark:text-ink-600">
                            {loading
                              ? "\u2014"
                              : formatEuro(calcBalance(allTransactions, p.id))}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {sec.pots.length > 5 && (
                    <button
                      onClick={() => onOpenGroup(sec.id)}
                      className="mt-2 text-left text-xs font-semibold text-ink-700 hover:underline dark:text-ink-700"
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
    <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-900">
      {FLOW_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
            value === t.id
              ? "bg-white text-ink-700 shadow-sm dark:bg-ink-800 dark:text-white"
              : "text-ink-700 hover:text-ink-800 dark:text-ink-500"
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
    <div className="rounded-md border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-600 dark:text-ink-500">
          {label}
          {sub && (
            <span className="ml-1.5 normal-case tracking-normal text-ink-600 dark:text-ink-600">
              · {sub}
            </span>
          )}
        </p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            positive
              ? "bg-in-100 text-in-600 dark:bg-in-700/30 dark:text-in-400"
              : "bg-uit-100 text-uit-600 dark:bg-uit-700/30 dark:text-uit-400"
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
        className={`font-num text-[1.5rem] font-semibold tabular-nums [letter-spacing:-0.02em] ${
          positive
            ? "text-in-600 dark:text-in-400"
            : "text-uit-600 dark:text-uit-400"
        }`}
      >
        {value}
      </p>
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
    <aside className="flex h-fit min-w-0 flex-col rounded-md border border-ink-300/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.1)] dark:border-ink-800/60 dark:bg-ink-950 dark:shadow-none">
      <h2 className="mb-4 font-num text-[11px] font-bold text-ink-600 dark:text-ink-500">
        Recente activiteit
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-ink-600 dark:text-ink-600">Nog geen transacties.</p>
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
                      ? "bg-in-100 text-in-600 dark:bg-in-700/30 dark:text-in-400"
                      : "bg-uit-100 text-uit-600 dark:bg-uit-700/30 dark:text-uit-400"
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
                    <span className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                      {tx.counterparty}
                    </span>
                    <span
                      className={`whitespace-nowrap font-num text-sm font-semibold tabular-nums ${
                        positive
                          ? "text-in-600 dark:text-in-400"
                          : "text-fout-600 dark:text-fout-400"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {formatEuro(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-xs text-ink-600 dark:text-ink-600">
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
