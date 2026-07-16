import { useState } from "react";
import type { FormEvent } from "react";
import type { Pot } from "../types";

type Props = {
  pots: Pot[];
  /** Potje dat vooraf als bron geselecteerd is (bv. vanuit een potdetail). */
  initialFromPotId?: string | null;
  onSubmit: (values: {
    fromPotId: string;
    toPotId: string;
    amount: number;
    occurredOn: string;
    memo?: string;
  }) => Promise<{ error: string | null }>;
  onCancel: () => void;
};

/**
 * Verplaats geld tussen twee potjes. Netto verandert je rekeningsaldo niet;
 * enkel de verdeling over de potjes verschuift. De parent maakt hier twee
 * gekoppelde transacties van (uit op bron, in op doel).
 */
export function TransferForm({ pots, initialFromPotId, onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [fromPotId, setFromPotId] = useState(initialFromPotId ?? pots[0]?.id ?? "");
  const [toPotId, setToPotId] = useState(
    pots.find((p) => p.id !== (initialFromPotId ?? pots[0]?.id))?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pots.length < 2) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Je hebt minstens twee potjes nodig om geld te kunnen verplaatsen.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount.replace(",", "."));
    if (fromPotId === toPotId) {
      setError("Kies twee verschillende potjes.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Vul een positief bedrag in.");
      return;
    }
    setBusy(true);
    const res = await onSubmit({ fromPotId, toPotId, amount: parsed, occurredOn, memo: memo.trim() || undefined });
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-navy-500 dark:text-navy-300">
        Verschuif geld tussen potjes. Je totale rekeningsaldo verandert niet, de
        verdeling wel.
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Van
          </span>
          <select
            value={fromPotId}
            onChange={(e) => setFromPotId(e.target.value)}
            className="input"
          >
            {pots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-2.5 text-navy-400" aria-hidden>
          →
        </span>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Naar
          </span>
          <select
            value={toPotId}
            onChange={(e) => setToPotId(e.target.value)}
            className="input"
          >
            {pots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Bedrag
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
              className="input pl-7 tabular-nums"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
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
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Notitie <span className="text-navy-400">(optioneel)</span>
        </span>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Bijv. maandelijkse verdeling"
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
          {busy ? "Bezig…" : "Verplaatsen"}
        </button>
      </div>
    </form>
  );
}
