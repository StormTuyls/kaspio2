import { useState } from "react";
import { formatDate, formatEuro } from "../storage";
import type { Pot, Transaction } from "../types";
import { useAlert, useConfirm } from "./ConfirmDialog";

import { Foutmelding } from "./Foutmelding";
type Props = {
  /** Alleen de onverdeelde transacties (potId === null). */
  transactions: Transaction[];
  pots: Pot[];
  onAssign: (
    txId: string,
    parts: { potId: string; amount: number }[],
  ) => Promise<{ error: string | null }>;
  onDelete: (txId: string) => void;
  /** Bulk verwijderen van geselecteerde onverdeelde transacties. */
  onBulkDelete?: (txIds: string[]) => void | Promise<unknown>;
  /**
   * Bulk toewijzen: alle geselecteerde transacties in hun geheel naar één
   * potje. Splitsen blijft per transactie, via het paneel hieronder.
   */
  onBulkAssign?: (
    txIds: string[],
    potId: string,
  ) => Promise<{ error: string | null }>;
  /**
   * Bewust in de hoofdpot houden. Dat is de tweede geldige beslissing naast
   * toewijzen, en pas daarna mag het geld verdeeld worden.
   */
  onKeepInHoofdpot?: (
    txId: string,
    confirm: boolean,
  ) => Promise<{ error: string | null }>;
  /** Een hele selectie in één keer bewust in de hoofdpot houden. */
  onBulkKeepInHoofdpot?: (
    txIds: string[],
  ) => Promise<{ error: string | null }>;
};

/**
 * "Toe te wijzen" inbox: lijst van transacties zonder potje. Per transactie
 * kan de admin toewijzen aan één potje of splitsen over meerdere, of ze snel
 * (in bulk) verwijderen.
 */
export function UnallocatedInbox({
  transactions,
  pots,
  onAssign,
  onDelete,
  onBulkDelete,
  onBulkAssign,
  onKeepInHoofdpot,
  onBulkKeepInHoofdpot,
}: Props) {
  const confirm = useConfirm();
  const alert = useAlert();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPotId, setBulkPotId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [keepBusy, setKeepBusy] = useState<string | null>(null);

  // De rekening tonen heeft alleen zin als er meer dan één in de inbox zit.
  // Bij een club met vier rekeningen is dat juist het eerste wat je wil weten;
  // bij een club met één zou het alleen ruis zijn.
  const accounts = new Set(
    transactions.map((t) => t.bankAccount).filter(Boolean) as string[],
  );
  const toonRekening = accounts.size > 1;

  // Hoe vaak komt dezelfde tegenpartij nog voor in de inbox? Dat is het signaal
  // dat je niet één regel maar een hele reeks in één keer kan afhandelen, en
  // precies waar de selectievakjes voor bedoeld zijn.
  const perTegenpartij = new Map<string, number>();
  for (const t of transactions) {
    const k = (t.counterparty || "").trim().toLowerCase();
    if (k) perTegenpartij.set(k, (perTegenpartij.get(k) ?? 0) + 1);
  }

  /** Selectie bevat allocatie-id's; mutaties werken op bankregels. */
  function toTransactionIds(ids: string[]): string[] {
    const set = new Set(ids);
    return [
      ...new Set(
        transactions.filter((t) => set.has(t.id)).map((t) => t.transactionId),
      ),
    ];
  }

  const allSelected =
    transactions.length > 0 && transactions.every((t) => selected.has(t.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      transactions.every((t) => prev.has(t.id))
        ? new Set()
        : new Set(transactions.map((t) => t.id)),
    );
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
    if (onBulkDelete) await onBulkDelete(ids);
    else ids.forEach((id) => onDelete(id));
    setSelected(new Set());
  }

  async function bulkKeep() {
    const ids = toTransactionIds([...selected]);
    if (ids.length === 0 || !onBulkKeepInHoofdpot) return;
    if (
      !(await confirm({
        title: `${ids.length} ${ids.length === 1 ? "transactie" : "transacties"} in de hoofdpot houden?`,
        message:
          "Dit geld krijgt geen eigen potje en wordt daarmee verdeelbaar. Je kan het later alsnog toewijzen zolang het niet verdeeld is.",
        confirmLabel: "In de hoofdpot houden",
      }))
    ) {
      return;
    }
    setBulkBusy(true);
    const res = await onBulkKeepInHoofdpot(ids);
    setBulkBusy(false);
    if (res.error) {
      await alert({ title: "Lukt niet", message: res.error });
      return;
    }
    setSelected(new Set());
  }

  async function bulkAssign() {
    const ids = toTransactionIds([...selected]);
    if (ids.length === 0 || !bulkPotId || !onBulkAssign) return;
    const potName = pots.find((p) => p.id === bulkPotId)?.name ?? "dit potje";
    if (
      !(await confirm({
        title: `${ids.length} ${ids.length === 1 ? "transactie" : "transacties"} naar ${potName}?`,
        message:
          "Het volledige bedrag van elke geselecteerde transactie gaat naar dat potje. Wil je er één splitsen over meerdere potjes, doe die dan apart.",
        confirmLabel: "Toewijzen",
      }))
    ) {
      return;
    }
    setBulkBusy(true);
    const res = await onBulkAssign(ids, bulkPotId);
    setBulkBusy(false);
    if (res.error) {
      await alert({ title: "Toewijzen mislukt", message: res.error });
      return;
    }
    setSelected(new Set());
    setBulkPotId("");
  }

  if (transactions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-basis">
        Alles is toegewezen. Nieuw geld zonder potje verschijnt hier.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-basis">
        Dit geld staat op de rekening maar heeft nog geen bestemming. Wijs het
        toe aan een potje, of hou het bewust in de hoofdpot. Pas daarna kan je
        het verdelen.
      </p>
      {(onBulkDelete || onBulkAssign) && (
        <div className="space-y-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 dark:border-ink-800/60 dark:bg-ink-900/40">
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-basis">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 accent-teal-600"
              />
              Alles selecteren
            </label>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs font-medium text-basis hover:underline"
              >
                {selected.size} geselecteerd · wis
              </button>
            )}
          </div>

          {/* Acties pas tonen zodra er iets geselecteerd is, en op mobiel onder
              elkaar: de potjeskiezer heeft de volle breedte nodig. */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {onBulkAssign && (
                <>
                  <select
                    value={bulkPotId}
                    onChange={(e) => setBulkPotId(e.target.value)}
                    aria-label="Potje voor de geselecteerde transacties"
                    className="input basis-full sm:w-auto sm:flex-1"
                  >
                    <option value="">Kies een potje…</option>
                    {pots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={bulkAssign}
                    disabled={!bulkPotId || bulkBusy}
                    className="btn-accent flex-1 px-3 py-1.5 text-xs sm:flex-none"
                  >
                    {bulkBusy ? "Bezig…" : `${selected.size} toewijzen`}
                  </button>
                </>
              )}
              {onBulkKeepInHoofdpot && (
                <button
                  onClick={bulkKeep}
                  disabled={bulkBusy}
                  title="Dit geld heeft geen specifiek doel en blijft in de hoofdpot"
                  className="btn-secondary flex-1 px-3 py-1.5 text-xs sm:flex-none"
                >
                  Hou in hoofdpot
                </button>
              )}
              {onBulkDelete && (
                <button
                  onClick={bulkDelete}
                  className="btn-danger flex-1 px-3 py-1.5 text-xs sm:flex-none"
                >
                  Verwijderen
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <ul className="divide-y divide-ink-200 dark:divide-ink-800/60">
        {transactions.map((tx) => (
          <li key={tx.id} className="py-3">
            {/* Op mobiel zakken de acties naar een eigen regel: naast de knoppen
                bleef er anders zo'n 80px over voor tegenpartij en mededeling,
                waardoor beide na een paar letters afgekapt werden. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {onBulkDelete && (
                <input
                  type="checkbox"
                  checked={selected.has(tx.id)}
                  onChange={() => toggle(tx.id)}
                  className="h-4 w-4 flex-shrink-0 accent-teal-600"
                  aria-label="Selecteer transactie"
                />
              )}
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  tx.direction === "in"
                    ? "bg-in-100 text-in-600 dark:bg-in-700/30 dark:text-in-400"
                    : "bg-uit-100 text-uit-700 dark:bg-uit-700/30 dark:text-uit-400"
                }`}
              >
                {tx.direction === "in" ? "↓" : "↑"}
              </div>
              {/* min-w: onder deze breedte wrapt de knoppenrij naar
                  beneden in plaats van de tekst plat te drukken. */}
              <div className="min-w-[15rem] flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-sterk">
                    {tx.counterparty || "Onbekend"}
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold tabular-nums text-sterk">
                    {tx.direction === "in" ? "+" : "−"}
                    {formatEuro(tx.amount)}
                  </span>
                </div>

                {/* Datum en rekening op één regel: kort, vast, en altijd
                    zichtbaar. De mededeling krijgt daaronder de volle breedte,
                    want die is lang en juist daar staat de gestructureerde
                    referentie waaraan je de post herkent. */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zacht">
                  <span className="whitespace-nowrap">{formatDate(tx.occurredOn)}</span>
                  {toonRekening && tx.bankAccount && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{tx.bankAccount}</span>
                    </>
                  )}
                  {(() => {
                    const k = (tx.counterparty || "").trim().toLowerCase();
                    const n = (k && perTegenpartij.get(k)) || 0;
                    return n > 1 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-basis">
                          nog {n - 1} van deze tegenpartij
                        </span>
                      </>
                    ) : null;
                  })()}
                </div>

                {tx.memo && (
                  <p
                    className="mt-0.5 line-clamp-2 break-all text-xs text-zacht"
                    title={tx.memo}
                  >
                    {tx.memo}
                  </p>
                )}
              </div>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                {onKeepInHoofdpot && (
                  <button
                    onClick={async () => {
                      setKeepBusy(tx.id);
                      const res = await onKeepInHoofdpot(tx.transactionId, true);
                      setKeepBusy(null);
                      if (res.error) {
                        await alert({
                          title: "Lukt niet",
                          message: res.error,
                        });
                      }
                    }}
                    disabled={keepBusy === tx.id}
                    title="Dit geld heeft geen specifiek doel en blijft in de hoofdpot"
                    className="btn-secondary flex-shrink-0 px-3 py-1.5 text-xs"
                  >
                    {keepBusy === tx.id ? "Bezig…" : "Hou in hoofdpot"}
                  </button>
                )}
                <button
                  onClick={() => setOpenId(openId === tx.id ? null : tx.id)}
                  className="btn-accent flex-shrink-0 px-3 py-1.5 text-xs"
                >
                  {openId === tx.id ? "Sluit" : "Toewijzen"}
                </button>
                <button
                  onClick={async () => {
                    if (await confirm({ title: "Transactie verwijderen?", confirmLabel: "Verwijderen", danger: true }))
                      onDelete(tx.transactionId);
                  }}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-zwak hover:bg-fout-100 hover:text-fout-600 sm:h-auto sm:w-auto sm:px-2 sm:py-1 dark:hover:bg-fout-600/30 dark:hover:text-fout-400"
                  aria-label="Verwijderen"
                >
                  ✕
                </button>
              </div>
            </div>

            {openId === tx.id && (
              <AssignPanel
                tx={tx}
                pots={pots}
                onAssign={async (parts) => {
                  const res = await onAssign(tx.transactionId, parts);
                  if (!res.error) setOpenId(null);
                  return res;
                }}
                onDelete={async () => {
                  if (await confirm({ title: "Transactie verwijderen?", confirmLabel: "Verwijderen", danger: true }))
                    onDelete(tx.transactionId);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type PartRow = { potId: string; amount: string };

function AssignPanel({
  tx,
  pots,
  onAssign,
  onDelete,
}: {
  tx: Transaction;
  pots: Pot[];
  onAssign: (
    parts: { potId: string; amount: number }[],
  ) => Promise<{ error: string | null }>;
  onDelete: () => void;
}) {
  const [rows, setRows] = useState<PartRow[]>([
    { potId: pots[0]?.id ?? "", amount: String(tx.amount) },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = rows.map((r) => ({
    potId: r.potId,
    amount: Number(r.amount.replace(",", ".")),
  }));
  const sum = parsed.reduce(
    (s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0),
    0,
  );
  const remainder = Math.round((tx.amount - sum) * 100) / 100;

  function updateRow(i: number, patch: Partial<PartRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { potId: pots[0]?.id ?? "", amount: remainder > 0 ? String(remainder) : "" },
    ]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setError(null);
    if (parsed.some((p) => !p.potId)) {
      setError("Kies voor elk deel een potje.");
      return;
    }
    if (parsed.some((p) => !Number.isFinite(p.amount) || p.amount <= 0)) {
      setError("Elk deel moet een positief bedrag zijn.");
      return;
    }
    if (remainder !== 0) {
      setError(
        remainder > 0
          ? `Nog ${formatEuro(remainder)} niet verdeeld.`
          : `${formatEuro(-remainder)} te veel verdeeld.`,
      );
      return;
    }
    setBusy(true);
    const res = await onAssign(parsed);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-900/50">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.potId}
            onChange={(e) => updateRow(i, { potId: e.target.value })}
            className="input flex-1 py-1.5 text-sm"
          >
            <option value="">Kies potje…</option>
            {pots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="relative w-28">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zacht">
              €
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => updateRow(i, { amount: e.target.value })}
              className="input py-1.5 pl-6 text-sm tabular-nums"
            />
          </div>
          {rows.length > 1 && (
            <button
              onClick={() => removeRow(i)}
              className="flex-shrink-0 rounded-md px-1.5 py-1 text-zwak hover:bg-fout-100 hover:text-fout-600 dark:hover:bg-fout-600/30"
              aria-label="Deel verwijderen"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between text-xs">
        <button
          onClick={addRow}
          className="font-semibold text-in-700 hover:underline dark:text-in-400"
        >
          + Verdeel over meerdere potjes
        </button>
        {remainder !== 0 && (
          <span
            className={
              remainder > 0
                ? "text-uit-700 dark:text-uit-400"
                : "text-fout-600 dark:text-fout-400"
            }
          >
            {remainder > 0
              ? `Nog ${formatEuro(remainder)} te verdelen`
              : `${formatEuro(-remainder)} te veel`}
          </span>
        )}
      </div>

      {error && (
        <Foutmelding className="text-xs">
          {error}
        </Foutmelding>
      )}

      <div className="flex justify-between pt-1">
        <button
          onClick={onDelete}
          className="text-xs text-zacht hover:text-fout-600 dark:hover:text-fout-400"
        >
          Verwijderen
        </button>
        <button onClick={submit} disabled={busy} className="btn-accent px-4 py-1.5 text-sm">
          {busy ? "Bezig…" : "Bevestig"}
        </button>
      </div>
    </div>
  );
}
