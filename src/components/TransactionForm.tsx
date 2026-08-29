import { useState } from "react";
import type { FormEvent } from "react";
import type { Pot, TransactionDirection } from "../types";

import { Veld as Field } from "./Veld";
import { Foutmelding } from "./Foutmelding";
/** Sentinel voor de "nog niet toewijzen"-optie in de potkiezer. */
const UNALLOCATED = "__unallocated__";

type Props = {
  onSubmit: (values: {
    potId: string | null;
    direction: TransactionDirection;
    amount: number;
    occurredOn: string;
    counterparty: string;
    memo?: string;
  }) => void | Promise<void>;
  onCancel: () => void;
  /** Potjes voor de kiezer. */
  pots: Pot[];
  /** Vooraf geselecteerd potje (bv. vanuit PotDetail). */
  initialPotId?: string | null;
  /** Toon de "Nog toe te wijzen"-optie (alleen voor admins). */
  allowUnallocated?: boolean;
};

export function TransactionForm({
  onSubmit,
  onCancel,
  pots,
  initialPotId,
  allowUnallocated = false,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [direction, setDirection] = useState<TransactionDirection>("in");
  const [potId, setPotId] = useState<string>(
    initialPotId ?? (allowUnallocated ? UNALLOCATED : pots[0]?.id ?? ""),
  );
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
    if (!potId) {
      setError("Kies een potje.");
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
        potId: potId === UNALLOCATED ? null : potId,
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
          className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition ${
            direction === "in"
              ? "border-in-600 bg-in-100 text-in-700 dark:bg-in-700/30 dark:text-in-400"
              : "border-ink-200 text-basis hover:border-ink-300 dark:border-ink-800 dark:hover:border-ink-600"
          }`}
        >
          <span className="text-base">↓</span> Inkomend
        </button>
        <button
          type="button"
          onClick={() => setDirection("out")}
          className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition ${
            direction === "out"
              ? "border-uit-600 bg-uit-100 text-uit-700 dark:bg-uit-700/30 dark:text-uit-400"
              : "border-ink-200 text-basis hover:border-ink-300 dark:border-ink-800 dark:hover:border-ink-600"
          }`}
        >
          <span className="text-base">↑</span> Uitgaand
        </button>
      </div>

      <Field
        label="Potje"
        required
        hint={
          allowUnallocated
            ? "Weet je nog niet waarvoor het is? Kies 'Nog toe te wijzen', dan verdeel je het later."
            : undefined
        }
      >
        <select
          value={potId}
          onChange={(e) => setPotId(e.target.value)}
          className="input"
        >
          {allowUnallocated && (
            <option value={UNALLOCATED}>Nog toe te wijzen</option>
          )}
          {pots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bedrag" required prefix="€">
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="input pl-7"
          />
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

      {error && <Foutmelding>{error}</Foutmelding>}

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

