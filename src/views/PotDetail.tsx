import { Fragment, useEffect, useMemo, useState } from "react";
import { calcBalance, calcSpent, formatDate, formatEuro } from "../storage";
import { potProgress } from "../potProgress";
import type { Member, Pot, PotGroup, Transaction, TransactionDirection } from "../types";
import type { SubTier } from "../supabase";
import { attachmentsEnabled, chartsEnabled, type RecurringPlan } from "../data";
import { Modal } from "../components/Modal";
import { useConfirm } from "../components/ConfirmDialog";
import { PotForm } from "../components/PotForm";
import { BalanceChart } from "../components/BalanceChart";
import { UpgradeHint } from "../components/UpgradeHint";
import { TransactionAttachments } from "../components/TransactionAttachments";
import { Avatar } from "./Overview";
import { exportPotCsv, exportPotPdf } from "../csv";

type Props = {
  pot: Pot;
  transactions: Transaction[];
  members: Member[];
  currentUser: Member;
  /** Licentie: grafieken zijn Pro+, bijlagen zijn Team. */
  tier?: SubTier;
  /** Org-id (nodig voor bijlagen / Storage-pad). */
  orgId?: string | null;
  onUpgrade?: () => void;
  /** Potgroepen voor het bewerk-formulier. */
  groups?: PotGroup[];
  onCreateGroup?: (
    name: string,
  ) => Promise<{ error: string | null; groupId?: string }>;
  onBack: () => void;
  onAddTransaction: () => void;
  onDeleteTransaction: (id: string) => void;
  /** Meerdere transacties in één keer verwijderen (bulk). */
  onBulkDeleteTransactions?: (ids: string[]) => void | Promise<unknown>;
  /** Alle (zichtbare) potjes, voor "verplaats naar" bij bulk-selectie. */
  pots?: Pot[];
  /** Geselecteerde transacties naar een ander potje verplaatsen (herverdelen). */
  onReassignTransactions?: (ids: string[], toPotId: string) => void | Promise<unknown>;
  onUpdatePot: (patch: {
    name: string;
    color?: string;
    targetAmount?: number;
    description?: string;
    groupId?: string | null;
  }) => void | Promise<void>;
  onDeletePot: () => void;
  /** Actieve terugkerende boekingen (voor de reservering-indicator). */
  recurringPlans?: RecurringPlan[];
};

type DirectionFilter = "all" | TransactionDirection;

export function PotDetail({
  pot,
  transactions,
  members,
  currentUser,
  tier = "free",
  orgId = null,
  onUpgrade,
  groups,
  onCreateGroup,
  onBack,
  pots = [],
  onAddTransaction,
  onDeleteTransaction,
  onBulkDeleteTransactions,
  onReassignTransactions,
  onUpdatePot,
  onDeletePot,
  recurringPlans = [],
}: Props) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isAdmin = currentUser.role === "admin";
  // Bijlagen (bonnetjes/facturen) zijn een Team-feature en vereisen een org-id.
  const canUseAttachments = attachmentsEnabled(tier) && !!orgId;
  // Lezers zien alleen; admins en pot-verantwoordelijken mogen transacties
  // toevoegen. Verwijderen van transacties is admin-only (RLS dwingt dit ook af).
  const canAddTransaction = currentUser.role !== "reader";

  const balance = calcBalance(transactions, pot.id);
  // Domiciliëringen die op dit potje gereserveerd zijn (verwachte afhoudingen).
  const domicilieringen = recurringPlans.filter(
    (p) => p.active && p.kind === "domiciliering" && p.pot_id === pot.id,
  );
  const reservedTotal = domicilieringen.reduce((s, p) => s + p.amount, 0);
  const potTx = useMemo(
    () =>
      transactions
        .filter((t) => t.potId === pot.id)
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    [transactions, pot.id],
  );

  const totalIn = potTx.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = potTx.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const owner = members.find((m) => m.id === pot.ownerId);
  const progress = potProgress(pot.targetAmount, pot.targetKind, {
    balance,
    totalOut: calcSpent(transactions, pot.id),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return potTx.filter((t) => {
      if (direction !== "all" && t.direction !== direction) return false;
      if (q) {
        const inName = t.counterparty.toLowerCase().includes(q);
        const inMemo = (t.memo ?? "").toLowerCase().includes(q);
        if (!inName && !inMemo) return false;
      }
      return true;
    });
  }, [potTx, search, direction]);

  // Selectie resetten wanneer je naar een ander potje kijkt.
  useEffect(() => {
    setSelected(new Set());
  }, [pot.id]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (filtered.every((t) => next.has(t.id))) {
        filtered.forEach((t) => next.delete(t.id));
      } else {
        filtered.forEach((t) => next.add(t.id));
      }
      return next;
    });
  }

  async function bulkDelete() {
    const ids = toTransactionIds([...selected]);
    if (ids.length === 0) return;
    if (
      !(await confirm({
        title: `${ids.length} ${ids.length === 1 ? "transactie" : "transacties"} verwijderen?`,
        confirmLabel: "Verwijderen",
        danger: true,
      }))
    ) {
      return;
    }
    if (onBulkDeleteTransactions) await onBulkDeleteTransactions(ids);
    else ids.forEach((id) => onDeleteTransaction(id));
    setSelected(new Set());
  }

  const otherPots = pots.filter((p) => p.id !== pot.id);

  /** Selectie bevat allocatie-id's; mutaties werken op bankregels. */
  function toTransactionIds(ids: string[]): string[] {
    const set = new Set(ids);
    return [
      ...new Set(
        transactions.filter((t) => set.has(t.id)).map((t) => t.transactionId),
      ),
    ];
  }

  async function reassignSelected(toPotId: string) {
    const ids = [...selected];
    if (ids.length === 0 || !toPotId || !onReassignTransactions) return;
    // De selectie bevat allocatie-id's; de mutatie werkt op bankregels.
    await onReassignTransactions(toTransactionIds(ids), toPotId);
    setSelected(new Set());
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
      >
        ← Terug naar overzicht
      </button>

      <div className="card relative overflow-hidden p-6">
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ backgroundColor: pot.color ?? "#1D9E75" }}
        />
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: pot.color ?? "#1D9E75" }}
              />
              <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                {pot.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-navy-500 dark:text-navy-300">
              <Avatar name={owner?.name ?? "—"} size="sm" />
              <span>{owner?.name ?? "Geen verantwoordelijke"}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportPotCsv(pot, potTx)}
                disabled={potTx.length === 0}
                className="btn-secondary text-sm"
                title="Download als CSV"
              >
                ⬇ CSV
              </button>
              {chartsEnabled(tier) && (
                <button
                  onClick={() => exportPotPdf(pot, potTx)}
                  disabled={potTx.length === 0}
                  className="btn-secondary text-sm"
                  title="Exporteer als PDF (Pro)"
                >
                  ⬇ PDF
                </button>
              )}
              <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
                Bewerken
              </button>
              <button
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Potje "${pot.name}" verwijderen?`,
                      message: "Alle transacties in dit potje worden ook verwijderd.",
                      confirmLabel: "Verwijderen",
                      danger: true,
                    })
                  ) {
                    onDeletePot();
                  }
                }}
                className="btn-danger text-sm"
              >
                Verwijderen
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
              Saldo
            </p>
            <p className="text-3xl font-extrabold text-navy-900 dark:text-white">
              {formatEuro(balance)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
              Inkomend
            </p>
            <p className="text-xl font-bold tabular-nums text-teal-700 dark:text-teal-300">
              {formatEuro(totalIn)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
              Uitgaand
            </p>
            <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {formatEuro(totalOut)}
            </p>
          </div>
        </div>

        {reservedTotal > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-900/15">
            <span className="font-num font-bold tabular-nums text-amber-800 dark:text-amber-200">
              {formatEuro(reservedTotal)}
            </span>
            <span className="text-amber-700 dark:text-amber-300">
              gereserveerd voor{" "}
              {domicilieringen.length === 1
                ? domicilieringen[0].counterparty || "een domiciliëring"
                : `${domicilieringen.length} domiciliëringen`}
              {domicilieringen.length === 1
                ? ` (rond de ${domicilieringen[0].day_of_month}e)`
                : ""}
              . Komt binnen via je bankimport.
            </span>
          </div>
        )}

        {progress !== null && (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs text-navy-500 dark:text-navy-300">
              <span>{progress.label}</span>
              <span
                className={`font-semibold ${
                  progress.over
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-teal-600 dark:text-teal-400"
                }`}
              >
                {progress.pct.toFixed(0)}%
                {progress.kind === "budget" ? " uitgegeven" : ""}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-navy-700">
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
      </div>

      {potTx.length > 0 &&
        (chartsEnabled(tier) ? (
          <BalanceChart transactions={potTx} />
        ) : (
          <UpgradeHint
            title="Saldo-grafiek"
            description="Bekijk het verloop van dit potje over tijd met Pro."
            onUpgrade={onUpgrade}
          />
        ))}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Transacties</h2>
          {canAddTransaction && (
            <button onClick={onAddTransaction} className="btn-accent text-sm">
              + Transactie
            </button>
          )}
        </div>

        {potTx.length === 0 ? (
          <div className="card border-dashed py-12 text-center">
            <p className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
              Nog geen transacties
            </p>
            <p className="text-sm text-navy-500 dark:text-navy-300">
              {canAddTransaction
                ? "Voeg de eerste in- of uitgaande transactie toe."
                : "Er zijn nog geen transacties voor dit potje."}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {isAdmin && selected.size > 0 && (
              <div className="flex items-center justify-between gap-3 border-b border-navy-100 bg-canvas px-4 py-2.5 dark:border-navy-700/60 dark:bg-navy-800/40">
                <span className="text-sm font-medium text-navy-700 dark:text-navy-100">
                  {selected.size} geselecteerd
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {onReassignTransactions && otherPots.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) void reassignSelected(e.target.value);
                      }}
                      className="input py-1.5 text-xs"
                      aria-label="Verplaats geselecteerde naar potje"
                    >
                      <option value="">Verplaats naar…</option>
                      {otherPots.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => setSelected(new Set())}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Wis selectie
                  </button>
                  <button onClick={bulkDelete} className="btn-danger px-3 py-1.5 text-xs">
                    Verwijderen
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 border-b border-navy-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 dark:border-navy-700/60">
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
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-navy-400 dark:text-navy-300">
                Geen transacties die overeenkomen met je filter.
              </div>
            ) : (
              <>
                <ul className="divide-y divide-navy-100 sm:hidden dark:divide-navy-700/60">
                  {filtered.map((tx) => (
                    <li key={tx.id} className="flex gap-3 px-4 py-3.5">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={selected.has(tx.id)}
                          onChange={() => toggleOne(tx.id)}
                          className="mt-1 h-4 w-4 flex-shrink-0 accent-teal-600"
                          aria-label="Selecteer transactie"
                        />
                      )}
                      <div className="min-w-0 flex-1">
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
                      <div className="flex items-center justify-between gap-3 text-xs text-navy-500 dark:text-navy-300">
                        <span>{formatDate(tx.occurredOn)}</span>
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              if (await confirm({ title: "Transactie verwijderen?", confirmLabel: "Verwijderen", danger: true }))
                                onDeleteTransaction(tx.transactionId);
                            }}
                            className="rounded-md px-2 py-1 text-navy-300 hover:bg-rose-50 hover:text-rose-600 dark:text-navy-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                            aria-label="Verwijderen"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {tx.memo && (
                        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">{tx.memo}</p>
                      )}
                      {canUseAttachments && (
                        <div className="mt-2">
                          <button
                            onClick={() =>
                              setExpandedTx((id) => (id === tx.id ? null : tx.id))
                            }
                            className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                          >
                            📎 Bijlagen {expandedTx === tx.id ? "verbergen" : "tonen"}
                          </button>
                          {expandedTx === tx.id && orgId && (
                            <div className="mt-2 rounded-lg bg-canvas p-3 dark:bg-navy-800/40">
                              <TransactionAttachments
                                orgId={orgId}
                                transactionId={tx.transactionId}
                                isAdmin={isAdmin}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    </li>
                  ))}
                </ul>

                <table className="hidden w-full text-sm sm:table">
                  <thead className="bg-canvas text-xs font-semibold uppercase tracking-wider text-navy-400 dark:bg-navy-800/50 dark:text-navy-300">
                    <tr>
                      {isAdmin && (
                        <th className="w-10 px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleAll}
                            className="h-4 w-4 accent-teal-600"
                            aria-label="Selecteer alle transacties"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left">Datum</th>
                      <th className="px-4 py-3 text-left">Tegenpartij</th>
                      <th className="px-4 py-3 text-left">Memo</th>
                      <th className="px-4 py-3 text-right">Bedrag</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100 dark:divide-navy-700/60">
                    {filtered.map((tx) => (
                      <Fragment key={tx.id}>
                      <tr
                        className={`transition hover:bg-canvas dark:hover:bg-navy-800/40 ${
                          selected.has(tx.id) ? "bg-teal-50/60 dark:bg-teal-900/10" : ""
                        }`}
                      >
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(tx.id)}
                              onChange={() => toggleOne(tx.id)}
                              className="h-4 w-4 accent-teal-600"
                              aria-label="Selecteer transactie"
                            />
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3 text-navy-500 dark:text-navy-300">
                          {formatDate(tx.occurredOn)}
                        </td>
                        <td className="px-4 py-3 font-medium text-navy-900 dark:text-navy-50">
                          {tx.counterparty}
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canUseAttachments && (
                              <button
                                onClick={() =>
                                  setExpandedTx((id) => (id === tx.id ? null : tx.id))
                                }
                                className={`text-sm ${
                                  expandedTx === tx.id
                                    ? "text-teal-700 dark:text-teal-300"
                                    : "text-navy-300 hover:text-teal-700 dark:text-navy-500 dark:hover:text-teal-300"
                                }`}
                                aria-label="Bijlagen"
                                title="Bijlagen"
                              >
                                📎
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={async () => {
                                  if (await confirm({ title: "Transactie verwijderen?", confirmLabel: "Verwijderen", danger: true }))
                                    onDeleteTransaction(tx.transactionId);
                                }}
                                className="text-xs text-navy-300 hover:text-rose-600 dark:text-navy-500 dark:hover:text-rose-400"
                                aria-label="Verwijderen"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {canUseAttachments && expandedTx === tx.id && orgId && (
                        <tr className="bg-canvas dark:bg-navy-800/40">
                          <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3">
                            <TransactionAttachments
                              orgId={orgId}
                              transactionId={tx.transactionId}
                              isAdmin={isAdmin}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>

      <Modal open={editing} title="Potje bewerken" onClose={() => setEditing(false)}>
        <PotForm
          initial={{
            name: pot.name,
            color: pot.color ?? "#1D9E75",
            targetAmount: pot.targetAmount,
            targetKind: pot.targetKind,
            groupId: pot.groupId ?? null,
          }}
          groups={groups}
          onCreateGroup={onCreateGroup}
          onSubmit={async (values) => {
            await onUpdatePot(values);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}
