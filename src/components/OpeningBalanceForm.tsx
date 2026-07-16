import { useState } from "react";
import type { FormEvent } from "react";

type Props = {
  onSubmit: (values: {
    amount: number;
    occurredOn: string;
    memo?: string;
  }) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Beginsaldo instellen: hoeveel geld stond er al op de rekening toen je met
 * Kaspio begon? De parent maakt hiervan een onverdeelde "in"-transactie, zodat
 * het totaal klopt met de echte rekening en het startbedrag daarna over de
 * potjes verdeeld kan worden via "Nog toe te wijzen".
 */
export function OpeningBalanceForm({ onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Vul een positief startbedrag in.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ amount: parsed, occurredOn, memo: "Beginsaldo bij start" });
    } catch {
      setError("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-navy-500 dark:text-navy-300">
        Hoeveel geld stond er op je rekening toen je met Kaspio begon? We zetten
        dat als startbedrag klaar bij <strong>Nog toe te wijzen</strong>, zodat je
        totaal klopt met je echte rekening. Daarna verdeel je het over je potjes.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Startbedrag
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-400">
            €
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            autoFocus
            className="input pl-7 tabular-nums"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Startdatum
        </span>
        <input
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="input"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
          Annuleren
        </button>
        <button type="submit" disabled={busy} className="btn-accent">
          {busy ? "Bezig…" : "Beginsaldo instellen"}
        </button>
      </div>
    </form>
  );
}
