import { useState } from "react";
import { calcBalance, formatDate, formatEuro } from "../storage";
import type { Member, Pot, Transaction } from "../types";
import { Modal } from "../components/Modal";
import { PotForm } from "../components/PotForm";
import { BalanceChart } from "../components/BalanceChart";
import { Avatar } from "./Overview";

type Props = {
  pot: Pot;
  transactions: Transaction[];
  members: Member[];
  currentUser: Member;
  onBack: () => void;
  onAddTransaction: () => void;
  onDeleteTransaction: (id: string) => void;
  onUpdatePot: (patch: { name: string; ownerId: string; targetAmount?: number }) => void;
  onDeletePot: () => void;
};

export function PotDetail({
  pot,
  transactions,
  members,
  currentUser,
  onBack,
  onAddTransaction,
  onDeleteTransaction,
  onUpdatePot,
  onDeletePot,
}: Props) {
  const [editing, setEditing] = useState(false);
  const isAdmin = currentUser.role === "admin";
  const balance = calcBalance(transactions, pot.id);
  const potTx = transactions
    .filter((t) => t.potId === pot.id)
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  const totalIn = potTx.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = potTx.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const owner = members.find((m) => m.id === pot.ownerId);
  const progress =
    pot.targetAmount && pot.targetAmount > 0
      ? Math.min(100, Math.max(0, (balance / pot.targetAmount) * 100))
      : null;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900"
      >
        ← Terug naar overzicht
      </button>

      <div className="card p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-navy-900">{pot.name}</h1>
            <div className="flex items-center gap-2 text-sm text-navy-500">
              <Avatar name={owner?.name ?? "—"} size="sm" />
              <span>{owner?.name ?? "Geen verantwoordelijke"}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
                Bewerken
              </button>
              <button
                onClick={() => {
                  if (confirm(`Potje "${pot.name}" en alle transacties verwijderen?`)) {
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
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Saldo</p>
            <p className="text-3xl font-extrabold text-navy-900">{formatEuro(balance)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Inkomend</p>
            <p className="text-xl font-bold text-mint-600">{formatEuro(totalIn)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Uitgaand</p>
            <p className="text-xl font-bold text-rose-600">{formatEuro(totalOut)}</p>
          </div>
        </div>

        {progress !== null && (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs text-navy-500">
              <span>Doel: {formatEuro(pot.targetAmount!)}</span>
              <span className="font-semibold text-mint-600">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-mint-500 to-mint-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {potTx.length > 0 && <BalanceChart transactions={potTx} />}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Transacties</h2>
          <button onClick={onAddTransaction} className="btn-accent text-sm">
            + Transactie
          </button>
        </div>

        {potTx.length === 0 ? (
          <div className="card border-dashed py-12 text-center">
            <p className="mb-1 text-base font-semibold text-navy-900">Nog geen transacties</p>
            <p className="text-sm text-navy-500">Voeg de eerste in- of uitgaande transactie toe.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs font-semibold uppercase tracking-wider text-navy-400">
                <tr>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Tegenpartij</th>
                  <th className="px-4 py-3 text-left">Memo</th>
                  <th className="px-4 py-3 text-right">Bedrag</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {potTx.map((tx) => (
                  <tr key={tx.id} className="transition hover:bg-canvas">
                    <td className="whitespace-nowrap px-4 py-3 text-navy-500">
                      {formatDate(tx.occurredOn)}
                    </td>
                    <td className="px-4 py-3 font-medium text-navy-900">{tx.counterparty}</td>
                    <td className="px-4 py-3 text-navy-500">{tx.memo ?? "—"}</td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                        tx.direction === "in" ? "text-mint-600" : "text-rose-600"
                      }`}
                    >
                      {tx.direction === "in" ? "+" : "−"}
                      {formatEuro(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm("Transactie verwijderen?")) onDeleteTransaction(tx.id);
                        }}
                        className="text-xs text-navy-300 hover:text-rose-600"
                        aria-label="Verwijderen"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={editing} title="Potje bewerken" onClose={() => setEditing(false)}>
        <PotForm
          initial={pot}
          members={members}
          onSubmit={(values) => {
            onUpdatePot(values);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}
