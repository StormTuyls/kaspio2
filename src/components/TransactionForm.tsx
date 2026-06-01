import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { TransactionDirection } from "../types";

type Props = {
  onSubmit: (values: {
    direction: TransactionDirection;
    amount: number;
    occurredOn: string;
    counterparty: string;
    memo?: string;
  }) => void | Promise<void>;
  onCancel: () => void;
};

export function TransactionForm({ onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [direction, setDirection] = useState<TransactionDirection>("in");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [counterparty, setCounterparty] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Vul een positief bedrag in.");
      return;
    }
    if (value > 1_000_000) {
      setError("Bedrag lijkt onrealistisch groot. Klopt dat?");
      return;
    }
    if (!counterparty.trim()) {
      setError(direction === "in" ? "Vul in van wie het bedrag komt." : "Vul in aan wie het bedrag gaat.");
      return;
    }
    if (!occurredOn) {
      setError("Vul een datum in.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        direction,
        amount: value,
        occurredOn,
        counterparty: counterparty.trim(),
        memo: memo.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Iets ging mis.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection("in")}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
            direction === "in"
              ? "border-mint-500 bg-mint-50 text-mint-700"
              : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
          }`}
        >
          <span className="text-base">↓</span> Inkomend
        </button>
        <button
          type="button"
          onClick={() => setDirection("out")}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
            direction === "out"
              ? "border-rose-500 bg-rose-50 text-rose-700"
              : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
          }`}
        >
          <span className="text-base">↑</span> Uitgaand
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bedrag" required>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-400">
              €
            </span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="input pl-7"
              required
            />
          </div>
        </Field>
        <Field label="Datum" required>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            max={today}
            className="input"
            required
          />
        </Field>
      </div>

      <Field
        label={direction === "in" ? "Van wie" : "Aan wie"}
        required
        hint="Naam van de tegenpartij. Wordt mee opgeslagen in het audit-spoor."
      >
        <input
          type="text"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          placeholder={
            direction === "in" ? "Bijv. Ouders kamp" : "Bijv. Sportwinkel Decathlon"
          }
          className="input"
          required
          maxLength={120}
        />
      </Field>

      <Field label="Memo" hint="Optionele toelichting">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Bijv. Voorschot kamp augustus"
          rows={2}
          maxLength={500}
          className="input resize-none"
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={busy}
        >
          Annuleren
        </button>
        <button type="submit" className="btn-accent" disabled={busy}>
          {busy ? "Bezig…" : "Toevoegen"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-navy-400 dark:text-navy-300">
          {hint}
        </span>
      )}
    </label>
  );
}
