import { useState } from "react";
import { calcBalance, formatDate, formatEuro } from "../storage";
import type { Member, Pot, Transaction } from "../types";
import { Modal } from "../components/Modal";
import { PotForm } from "../components/PotForm";
import { BalanceChart } from "../components/BalanceChart";

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

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Terug naar overzicht
      </button>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-900">{pot.name}</h1>
            <p className="text-sm text-gray-500">
              Verantwoordelijke: {owner?.name ?? "—"}
            </p>
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
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Saldo</p>
            <p className="text-3xl font-bold text-gray-900">{formatEuro(balance)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Inkomend</p>
            <p className="text-xl font-semibold text-emerald-600">{formatEuro(totalIn)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Uitgaand</p>
            <p className="text-xl font-semibold text-rose-600">{formatEuro(totalOut)}</p>
          </div>
        </div>

        {pot.targetAmount && pot.targetAmount > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Doel: {formatEuro(pot.targetAmount)}</span>
              <span>{Math.min(100, (balance / pot.targetAmount) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (balance / pot.targetAmount) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {potTx.length > 0 && (
        <div className="mb-6">
          <BalanceChart transactions={potTx} />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Transacties</h2>
        <button onClick={onAddTransaction} className="btn-primary">
          + Transactie
        </button>
      </div>

      {potTx.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
          <p className="mb-1 text-base font-medium text-gray-700">Nog geen transacties</p>
          <p className="text-sm text-gray-500">Voeg de eerste in- of uitgaande transactie toe.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3 text-left">Tegenpartij</th>
                <th className="px-4 py-3 text-left">Memo</th>
                <th className="px-4 py-3 text-right">Bedrag</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {potTx.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {formatDate(tx.occurredOn)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{tx.counterparty}</td>
                  <td className="px-4 py-3 text-gray-500">{tx.memo ?? "—"}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                      tx.direction === "in" ? "text-emerald-600" : "text-rose-600"
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
                      className="text-xs text-gray-400 hover:text-rose-600"
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
