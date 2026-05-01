import { useState } from "react";
import type { FormEvent } from "react";
import type { TransactionDirection } from "../types";

type Props = {
  onSubmit: (values: {
    direction: TransactionDirection;
    amount: number;
    occurredOn: string;
    counterparty: string;
    memo?: string;
  }) => void;
  onCancel: () => void;
};

export function TransactionForm({ onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [direction, setDirection] = useState<TransactionDirection>("in");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [counterparty, setCounterparty] = useState("");
  const [memo, setMemo] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    if (!counterparty.trim()) return;
    onSubmit({
      direction,
      amount: value,
      occurredOn,
      counterparty: counterparty.trim(),
      memo: memo.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection("in")}
          className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
            direction === "in"
              ? "border-mint-500 bg-mint-50 text-mint-700"
              : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
          }`}
        >
          ↓ Inkomend
        </button>
        <button
          type="button"
          onClick={() => setDirection("out")}
          className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
            direction === "out"
              ? "border-rose-500 bg-rose-50 text-rose-700"
              : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
          }`}
        >
          ↑ Uitgaand
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">Bedrag *</span>
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="input"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">Datum *</span>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="input"
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          {direction === "in" ? "Van wie?" : "Aan wie?"} *
        </span>
        <input
          type="text"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          placeholder="Bijv. Café De Vlaschaard"
          className="input"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">Memo</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Optionele toelichting"
          rows={2}
          className="input resize-none"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annuleren
        </button>
        <button type="submit" className="btn-accent">
          Toevoegen
        </button>
      </div>
    </form>
  );
}
