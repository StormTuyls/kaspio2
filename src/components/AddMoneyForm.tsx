import { useState } from "react";
import type { FormEvent } from "react";

type Props = {
  onSubmit: (values: {
    amount: number;
    occurredOn: string;
    counterparty?: string;
    memo?: string;
  }) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Geld toevoegen aan de hoofdpot. De parent maakt hiervan een onverdeelde
 * "in"-transactie, zodat je totaal klopt met je echte rekening en het bedrag
 * daarna over de potjes verdeeld kan worden.
 *
 * Dit is ook de weg voor je beginsaldo bij de start: dat is niets anders dan de
 * eerste keer geld toevoegen. Eén actie in plaats van twee begrippen.
 */
export function AddMoneyForm({ onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [counterparty, setCounterparty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Vul een bedrag groter dan 0 in.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        amount: parsed,
        occurredOn,
        counterparty: counterparty.trim() || undefined,
      });
    } catch {
      setError("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-700 dark:text-ink-500">
        Het bedrag komt in de <strong>hoofdpot</strong> te staan, bij "nog te
        verdelen". Van daaruit verdeel je het over je potjes. Begin je net met
        Kaspio? Zet hier wat er al op je rekening stond.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
            Bedrag
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-600">
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
          <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
            Datum
          </span>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="input"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
          Omschrijving <span className="text-ink-600">(optioneel)</span>
        </span>
        <input
          type="text"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          placeholder="Bijv. beginsaldo, lidgeld, sponsoring"
          className="input"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
          Annuleren
        </button>
        <button type="submit" disabled={busy} className="btn-accent">
          {busy ? "Bezig…" : "Toevoegen"}
        </button>
      </div>
    </form>
  );
}
