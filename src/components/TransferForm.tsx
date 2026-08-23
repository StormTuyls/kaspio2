import { useState } from "react";
import type { FormEvent } from "react";
import { calcBalance, formatEuro } from "../storage";
import type { Pot, Transaction } from "../types";

/** Waarde in de selects die voor de hoofdpot staat (pot_id null in de DB). */
const HOOFDPOT = "__hoofdpot__";

type Props = {
  pots: Pot[];
  /** Nodig om de saldo's per potje te tonen. */
  transactions: Transaction[];
  /** Potje dat vooraf als bron geselecteerd is (bv. vanuit een potdetail). */
  initialFromPotId?: string | null;
  /**
   * Mag de hoofdpot als bron of doel gekozen worden? Alleen admins beheren het
   * onverdeelde geld (RLS), dus voor de rest blijft dit potje-naar-potje.
   */
  allowHoofdpot?: boolean;
  onSubmit: (values: {
    fromPotId: string | null;
    toPotId: string | null;
    amount: number;
    occurredOn: string;
    memo?: string;
  }) => Promise<{ error: string | null }>;
  onCancel: () => void;
};

/**
 * Verplaats geld tussen twee potjes, of tussen een potje en de hoofdpot. Netto
 * verandert je rekeningsaldo niet; enkel de verdeling verschuift. De parent
 * maakt hier twee gekoppelde transacties van (uit op bron, in op doel).
 *
 * Geld naar de hoofdpot terugzetten is de omgekeerde weg van verdelen: het komt
 * weer op "nog te verdelen" te staan en kan later opnieuw verdeeld worden.
 */
export function TransferForm({
  pots,
  transactions,
  initialFromPotId,
  allowHoofdpot = false,
  onSubmit,
  onCancel,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  // Keuzelijst: de hoofdpot staat bovenaan, daarna de potjes.
  const parties = [
    ...(allowHoofdpot
      ? [{ id: HOOFDPOT, name: "Hoofdpot (nog te verdelen)" }]
      : []),
    ...pots.map((p) => ({ id: p.id, name: p.name })),
  ];
  const [fromPotId, setFromPotId] = useState(
    initialFromPotId ?? parties[0]?.id ?? "",
  );
  const [toPotId, setToPotId] = useState(
    parties.find((p) => p.id !== (initialFromPotId ?? parties[0]?.id))?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HOOFDPOT is een UI-waarde; in de data is de hoofdpot pot_id null.
  const toPotIdOrNull = (id: string) => (id === HOOFDPOT ? null : id);
  const fromBalance = calcBalance(transactions, toPotIdOrNull(fromPotId));
  const toBalance = calcBalance(transactions, toPotIdOrNull(toPotId));
  // Absoluut: een minteken (bv. bij het overnemen van een negatief saldo) mag
  // je niet blokkeren. Je verplaatst altijd een positief bedrag.
  const parsedAmount = Math.abs(Number(amount.replace(",", ".")));
  const willGoNegative =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && fromBalance - parsedAmount < 0;
  const toIsHoofdpot = toPotId === HOOFDPOT;

  if (parties.length < 2) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Je hebt minstens twee plekken nodig om geld te kunnen verplaatsen.
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
    const value = Math.abs(Number(amount.replace(",", ".")));
    if (fromPotId === toPotId) {
      setError("Kies twee verschillende potjes.");
      return;
    }
    if (!Number.isFinite(value) || value === 0) {
      setError("Vul een bedrag in.");
      return;
    }
    setBusy(true);
    const res = await onSubmit({
      fromPotId: toPotIdOrNull(fromPotId),
      toPotId: toPotIdOrNull(toPotId),
      amount: value,
      occurredOn,
      memo: memo.trim() || undefined,
    });
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-navy-500 dark:text-navy-300">
        Verschuif geld tussen potjes, of terug naar de hoofdpot om het later
        opnieuw te verdelen. Je totale rekeningsaldo verandert niet, de verdeling
        wel.
      </p>

      {/* Potnamen passen niet in een halve sheet-breedte, dus onder elkaar op
          mobiel. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Van
          </span>
          <select
            value={fromPotId}
            onChange={(e) => setFromPotId(e.target.value)}
            className="input"
          >
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-navy-500 dark:text-navy-300">
            Saldo: <span className="font-semibold tabular-nums">{formatEuro(fromBalance)}</span>
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Naar
          </span>
          <select
            value={toPotId}
            onChange={(e) => setToPotId(e.target.value)}
            className="input"
          >
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-navy-400 dark:text-navy-300">
            Saldo: <span className="tabular-nums">{formatEuro(toBalance)}</span>
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-navy-700 dark:text-navy-200">
            Bedrag
            {fromBalance !== 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(Math.abs(fromBalance)).replace(".", ","))}
                className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
              >
                Alles ({formatEuro(Math.abs(fromBalance))})
              </button>
            )}
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

      {toIsHoofdpot && parsedAmount > 0 && (
        <p className="text-xs text-navy-500 dark:text-navy-300">
          Dit bedrag komt weer bij "nog te verdelen" in de hoofdpot te staan.
        </p>
      )}

      {willGoNegative && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Het bronpotje komt hiermee onder nul (saldo nu {formatEuro(fromBalance)}).
          Dat mag, maar goed om te weten.
        </p>
      )}

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
