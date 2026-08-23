import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Pot, Transaction } from "../types";
import { matchRecurringPlan, type RecurringPlan, type TransactionInput } from "../data";
import {
  findDuplicate,
  guessColumns,
  normalizeCounterparty,
  sameParty,
  parseAmount,
  parseCsv,
  parseDate,
  type ColumnKey,
} from "../csvImport";

type Props = {
  open: boolean;
  pots: Pot[];
  /** Admins mogen "Onverdeeld" laten staan (komt in de inbox). */
  allowUnallocated: boolean;
  /**
   * Genormaliseerde tegenpartij → potje-id, op basis van eerdere toewijzingen.
   * Rijen met een bekende tegenpartij worden zo automatisch voorgesteld.
   */
  counterpartyPotHints?: Record<string, string>;
  /** Actieve domiciliëringen, om afhoudingen automatisch te herkennen. */
  recurringPlans?: RecurringPlan[];
  /** Wat er al in de organisatie staat, om dubbele import te herkennen. */
  existingTransactions?: Transaction[];
  onImport: (
    inputs: TransactionInput[],
  ) => Promise<{ error: string | null; count: number }>;
  onClose: () => void;
};

// Lege defaults op moduleniveau: een default-waarde in de destructuring ({} of
// []) is elke render een nieuw object, en dat laat elk effect dat erop let
// oneindig opnieuw draaien.
const NO_HINTS: Record<string, string> = {};
const NO_PLANS: RecurringPlan[] = [];
const NO_TRANSACTIONS: Transaction[] = [];

type DirectionMode = "sign" | "all_in" | "all_out";

type PreviewRow = {
  occurredOn: string | null;
  amount: number | null; // ondertekend zoals geparsed
  counterparty: string;
  memo: string;
  valid: boolean;
};

const UNALLOCATED = "__unallocated__";

const SAMPLE_CSV = `Datum;Bedrag;Tegenpartij;Mededeling
20/06/2026;-12,50;Colruyt;Boodschappen materiaal
21/06/2026;100,00;Jan Janssens;Lidgeld 2026
22/06/2026;-45,00;Sportshop;Ballen`;

function downloadSample() {
  // BOM zodat Excel UTF-8 herkent.
  const blob = new Blob(["﻿" + SAMPLE_CSV], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaspio-voorbeeld.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImportTransactionsModal({
  open,
  pots,
  allowUnallocated,
  counterpartyPotHints = NO_HINTS,
  recurringPlans = NO_PLANS,
  existingTransactions = NO_TRANSACTIONS,
  onImport,
  onClose,
}: Props) {
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [cols, setCols] = useState<Record<ColumnKey, number>>({
    date: -1,
    amount: -1,
    counterparty: -1,
    memo: -1,
  });
  const [dirMode, setDirMode] = useState<DirectionMode>("sign");
  const [targetPot, setTargetPot] = useState<string>(
    allowUnallocated ? UNALLOCATED : (pots[0]?.id ?? ""),
  );
  // Toewijzing per rij (potId of UNALLOCATED). De "alle rijen"-keuze vult deze;
  // per rij kan je daarna overschrijven.
  const [rowPot, setRowPot] = useState<string[]>([]);
  // Rijen die je niet wil importeren (index in preview). Zekere duplicaten
  // komen hier automatisch in te staan; jij kan elke rij aan- of uitzetten.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  // Afloop van een import: wat er binnen is, en welke rijen je oversloeg. Blijft
  // staan tot je sluit, zodat "alsnog importeren" mogelijk is.
  const [result, setResult] = useState<{ imported: number; skipped: number[] } | null>(null);
  // Welke rij zijn vergelijking openklapt (index in preview). Eén tegelijk: de
  // tabel is smal, en je vergelijkt er toch maar één per keer.
  const [openDup, setOpenDup] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset bij sluiten zodat een volgende import schoon start.
  useEffect(() => {
    if (!open) {
      setResult(null);
      setSkipped(new Set());
      setStep("upload");
      setFileName("");
      setHeaders([]);
      setRows([]);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("Kon geen rijen uit dit bestand lezen. Is het een CSV?");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setCols(guessColumns(parsed.headers));
      setStep("map");
    };
    reader.onerror = () => setError("Bestand kon niet gelezen worden.");
    reader.readAsText(file);
  }

  // Bouw de preview op basis van de gekozen kolommen.
  const preview = useMemo<PreviewRow[]>(() => {
    if (step !== "map") return [];
    return rows.map((r) => {
      const occurredOn = cols.date >= 0 ? parseDate(r[cols.date] ?? "") : null;
      const amount = cols.amount >= 0 ? parseAmount(r[cols.amount] ?? "") : null;
      const counterparty = cols.counterparty >= 0 ? (r[cols.counterparty] ?? "").trim() : "";
      const memo = cols.memo >= 0 ? (r[cols.memo] ?? "").trim() : "";
      const valid = occurredOn !== null && amount !== null && amount !== 0;
      return { occurredOn, amount, counterparty, memo, valid };
    });
  }, [step, rows, cols]);

  // Herken domiciliëringen: per rij de bijhorende actieve domiciliëring (of null).
  const matches = useMemo(() => {
    if (recurringPlans.length === 0) return preview.map(() => null);
    return preview.map((p) => {
      if (!p.valid || p.amount === null || !p.occurredOn) return null;
      const dir =
        dirMode === "all_in"
          ? "in"
          : dirMode === "all_out"
            ? "out"
            : p.amount < 0
              ? "out"
              : "in";
      return matchRecurringPlan(
        {
          counterparty: p.counterparty,
          amount: Math.abs(p.amount),
          direction: dir,
          occurredOn: p.occurredOn,
        },
        recurringPlans,
      );
    });
  }, [preview, recurringPlans, dirMode]);

  // Duplicaten: staat deze verrichting al in de organisatie? Interne regels
  // (transferGroup) tellen niet mee, zie findDuplicate.
  const duplicates = useMemo(
    () =>
      preview.map((p) => {
        if (!p.valid || p.amount === null || !p.occurredOn) return null;
        return findDuplicate(
          {
            occurredOn: p.occurredOn,
            amount: Math.abs(p.amount),
            direction: directionOf(p.amount),
            counterparty: p.counterparty,
          },
          existingTransactions,
        );
      }),
    // directionOf hangt van dirMode af; die staat expliciet in de deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, existingTransactions, dirMode],
  );

  // Zekere duplicaten staan standaard uit. Near-matches blijven aan: een
  // domiciliëring die een dag verschoof mag geen echte tweede afhouding slikken.
  //
  // Alleen opnieuw bepalen wanneer de rijen zelf veranderen (ander bestand,
  // andere kolommen, andere in/uit-regel). De duplicatenlijst verandert ook
  // wanneer de transacties in de app ververst worden, en dan mogen jouw eigen
  // vinkjes niet zomaar teruggezet worden.
  const duplicatesRef = useRef(duplicates);
  duplicatesRef.current = duplicates;
  useEffect(() => {
    setSkipped(
      new Set(
        duplicatesRef.current
          .map((d, i) => (d?.kind === "exact" ? i : -1))
          .filter((i) => i >= 0),
      ),
    );
  }, [preview, dirMode]);

  function toggleSkip(i: number) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // Seed de per-rij toewijzing, in volgorde van zekerheid:
  //   1. een herkende domiciliëring (bedrag + datum + tegenpartij kloppen),
  //   2. een tegenpartij die je eerder al aan een potje toewees,
  //   3. de bulk-keuze.
  // Een expliciet gekozen bulk-potje overstemt de hints (2), maar niet een
  // herkende domiciliëring (1): die hoort per definitie bij één potje.
  useEffect(() => {
    setRowPot(
      preview.map((p, i) => {
        const match = matches[i];
        if (match && pots.some((pot) => pot.id === match.pot_id)) {
          return match.pot_id;
        }
        if (targetPot === UNALLOCATED && p.counterparty) {
          const hint = counterpartyPotHints[normalizeCounterparty(p.counterparty)];
          if (hint && pots.some((pot) => pot.id === hint)) return hint;
        }
        return targetPot;
      }),
    );
  }, [preview, matches, targetPot, counterpartyPotHints, pots]);

  const validRows = preview.filter((p) => p.valid);
  const invalidCount = preview.length - validRows.length;
  // Naam van de bestaande transactie, maar alleen wanneer die de importrij
  // tegenspreekt. "AG INSURANCE NV" naast "AG Insurance" is dezelfde partij en
  // voegt niets toe; "Delhaize" naast "Colruyt" is precies wat je wil zien,
  // want dan is zelfde dag + zelfde bedrag misschien toch toeval.
  const otherParty = preview.map((p, i) => {
    const dup = duplicates[i];
    if (dup?.kind !== "exact" || !dup.existing.counterparty) return "";
    const mine = normalizeCounterparty(p.counterparty ?? "");
    if (!mine || sameParty(mine, dup.existing.counterparty)) return "";
    return dup.existing.counterparty.length > 22
      ? `${dup.existing.counterparty.slice(0, 22)}…`
      : dup.existing.counterparty;
  });

  const importIndexes = preview
    .map((p, i) => (p.valid && !skipped.has(i) ? i : -1))
    .filter((i) => i >= 0);
  const skippableIndexes = preview
    .map((p, i) => (p.valid && skipped.has(i) ? i : -1))
    .filter((i) => i >= 0);
  const importCount = importIndexes.length;
  const skippedCount = skippableIndexes.length;
  const duplicateCount = duplicates.filter(Boolean).length;
  const canImport =
    cols.date >= 0 && cols.amount >= 0 && importCount > 0 && !busy;

  function directionOf(signed: number): "in" | "out" {
    if (dirMode === "all_in") return "in";
    if (dirMode === "all_out") return "out";
    return signed < 0 ? "out" : "in";
  }

  /**
   * Importeer precies deze rijen (index in preview). Sluit het scherm niet: de
   * afloop blijft staan, zodat je overgeslagen rijen alsnog kan binnenhalen
   * zonder het bestand opnieuw te kiezen.
   */
  async function runImport(indexes: number[]) {
    setBusy(true);
    setError(null);
    const inputs: TransactionInput[] = indexes
      .map((i) => ({ p: preview[i], i }))
      .filter(({ p }) => p?.valid)
      .map(({ p, i }) => {
        const choice = rowPot[i] ?? targetPot;
        return {
          potId: choice === UNALLOCATED ? null : choice,
          amount: Math.abs(p.amount as number),
          direction: directionOf(p.amount as number),
          occurredOn: p.occurredOn as string,
          counterparty: p.counterparty || null,
          memo: p.memo || null,
        };
      });
    if (inputs.length === 0) {
      setBusy(false);
      return;
    }
    const res = await onImport(inputs);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const done = new Set(indexes);
    setResult((prev) => ({
      imported: (prev?.imported ?? 0) + inputs.length,
      // Wat we deze ronde binnenhaalden is geen "overgeslagen" meer.
      skipped: (prev ? prev.skipped : skippableIndexes).filter(
        (i) => !done.has(i),
      ),
    }));
  }

  if (!open) return null;

  const colSelect = (key: ColumnKey, label: string, required?: boolean) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <select
        value={cols[key]}
        onChange={(e) => setCols({ ...cols, [key]: Number(e.target.value) })}
        className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
      >
        <option value={-1}>— niet gebruiken —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Kolom ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* Zelfde sheet-gedrag als <Modal>, maar breder: de importstappen tonen
          een tabel met kolomkeuzes. */}
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl dark:bg-navy-900 dark:ring-1 dark:ring-navy-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4 dark:border-navy-700/60">
          <h2 className="min-w-0 truncate text-lg font-bold text-navy-900 dark:text-white">
            Transacties importeren
          </h2>
          <button
            onClick={onClose}
            className="-mr-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700 sm:h-8 sm:w-8 dark:hover:bg-navy-800 dark:hover:text-white"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-navy-500 dark:text-navy-300">
                Exporteer je rekeningafschrift als CSV vanuit je bank en laad het
                hier in. We herkennen automatisch de scheidingstekens en
                datum/bedrag-formaten.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 py-10 text-sm text-navy-500 hover:border-teal-400 hover:text-teal-700 dark:border-navy-600 dark:text-navy-300 dark:hover:border-teal-500">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFile}
                />
                <span className="text-2xl">📄</span>
                <span className="font-medium">Kies een CSV-bestand</span>
              </label>

              {/* Hoe moet het eruit zien */}
              <div className="rounded-xl border border-navy-100 bg-canvas p-4 dark:border-navy-700/60 dark:bg-navy-800/40">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
                    Voorbeeld
                  </span>
                  <button
                    onClick={downloadSample}
                    className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                  >
                    ↓ Download voorbeeldbestand
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-white p-3 text-xs leading-relaxed text-navy-600 ring-1 ring-navy-100 dark:bg-navy-900 dark:text-navy-200 dark:ring-navy-700/60">
{`Datum;Bedrag;Tegenpartij;Mededeling
20/06/2026;-12,50;Colruyt;Boodschappen
21/06/2026;100,00;Jan Janssens;Lidgeld 2026`}
                </pre>
                <ul className="mt-3 space-y-1 text-xs text-navy-500 dark:text-navy-400">
                  <li>
                    <strong className="text-navy-700 dark:text-navy-200">Datum</strong> en{" "}
                    <strong className="text-navy-700 dark:text-navy-200">Bedrag</strong> zijn
                    verplicht. Tegenpartij en mededeling zijn optioneel.
                  </li>
                  <li>
                    De kolomvolgorde maakt niet uit , je koppelt de kolommen in de
                    volgende stap.
                  </li>
                  <li>
                    Negatief bedrag = uitgave, positief = inkomst (of forceer het
                    nadien zelf).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === "map" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-navy-500 dark:text-navy-300">
                  {fileName} · {rows.length} rijen
                </span>
                <button
                  onClick={() => setStep("upload")}
                  className="shrink-0 text-teal-700 hover:underline dark:text-teal-300"
                >
                  Ander bestand
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {colSelect("date", "Datum", true)}
                {colSelect("amount", "Bedrag", true)}
                {colSelect("counterparty", "Tegenpartij")}
                {colSelect("memo", "Mededeling")}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
                    In / uit bepalen
                  </span>
                  <select
                    value={dirMode}
                    onChange={(e) => setDirMode(e.target.value as DirectionMode)}
                    className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
                  >
                    <option value="sign">Op teken (− = uit, + = in)</option>
                    <option value="all_out">Alles als uitgave</option>
                    <option value="all_in">Alles als inkomst</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
                    Potje voor alle rijen
                  </span>
                  <select
                    value={targetPot}
                    onChange={(e) => setTargetPot(e.target.value)}
                    className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
                  >
                    {allowUnallocated && (
                      <option value={UNALLOCATED}>Onverdeeld (later toewijzen)</option>
                    )}
                    {pots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-navy-100 dark:border-navy-700/60">
                <div className="flex items-center justify-between gap-2 border-b border-navy-100 px-3 py-2 dark:border-navy-700/60">
                  <span className="text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
                    Voorbeeld ({importCount} importeerbaar
                    {invalidCount > 0 ? `, ${invalidCount} onleesbaar` : ""})
                  </span>
                  <span className="text-[11px] font-normal normal-case text-navy-400 dark:text-navy-500">
                    potje per rij aanpasbaar →
                  </span>
                </div>
                {duplicateCount > 0 && (
                  <p className="border-b border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    {duplicateCount === 1
                      ? "1 rij lijkt al in Kaspio te staan"
                      : `${duplicateCount} rijen lijken al in Kaspio te staan`}
                    . Zekere duplicaten staan uit; vink ze aan als je ze toch wil
                    importeren.
                  </p>
                )}
                {/* Vijf kolommen (vinkje, datum, tegenpartij, bedrag, potje)
                    passen niet in een sheet van 375px. Op mobiel scrollt de
                    voorbeeldtabel daarom horizontaal i.p.v. samengedrukt te
                    worden; vanaf sm valt hij terug op de volle breedte. */}
                <div className="max-h-56 overflow-auto">
                  <table className="w-full min-w-[34rem] text-sm sm:min-w-0">
                    <tbody className="divide-y divide-navy-100 dark:divide-navy-700/60">
                      {preview.slice(0, 50).map((p, i) => {
                        const cpNorm = p.counterparty
                          ? normalizeCounterparty(p.counterparty)
                          : "";
                        const hintPotId = cpNorm
                          ? counterpartyPotHints[cpNorm]
                          : undefined;
                        // Bij een herkende domiciliëring toont die badge al; geen
                        // tweede "voorstel"-label erbij.
                        const suggested =
                          !matches[i] &&
                          !!hintPotId &&
                          pots.some((pt) => pt.id === hintPotId) &&
                          (rowPot[i] ?? targetPot) === hintPotId;
                        const dup = duplicates[i];
                        const skip = skipped.has(i);
                        const potNaam = (id: string | null) =>
                          id === null
                            ? "Hoofdpot"
                            : (pots.find((pt) => pt.id === id)?.name ??
                              "ander potje");
                        const gekozen = rowPot[i] ?? targetPot;
                        return (
                        <Fragment key={i}>
                        <tr
                          className={!p.valid ? "opacity-40" : skip ? "opacity-50" : ""}
                          title={p.valid ? "" : "Datum of bedrag onleesbaar — wordt overgeslagen"}
                        >
                          <td className="py-1.5 pl-3 pr-0 align-top">
                            {p.valid && (
                              <input
                                type="checkbox"
                                checked={!skip}
                                disabled={!!result}
                                onChange={() => toggleSkip(i)}
                                aria-label={skip ? "Deze rij toch importeren" : "Deze rij overslaan"}
                                className="mt-0.5 h-4 w-4 accent-teal-600"
                              />
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-navy-500 dark:text-navy-300">
                            {p.occurredOn ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-navy-700 dark:text-navy-200">
                            <span className="block max-w-[14rem] truncate">
                              {p.counterparty || p.memo || "—"}
                            </span>
                            {matches[i] && !dup && (
                              <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                ✨ herkende domiciliëring
                              </span>
                            )}
                            {dup && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenDup((cur) => (cur === i ? null : i))
                                }
                                aria-expanded={openDup === i}
                                title="Vergelijk met wat er al in Kaspio staat"
                                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold transition hover:brightness-95 ${
                                  dup.kind === "exact"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                }`}
                              >
                                {dup.kind === "exact"
                                  ? otherParty[i]
                                    ? `staat er al · ${otherParty[i]}`
                                    : "staat er al"
                                  : `lijkt op ${dup.existing.occurredOn}`}
                                <span aria-hidden className="ml-1 opacity-60">
                                  {openDup === i ? "▴" : "▾"}
                                </span>
                              </button>
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums ${
                              p.amount !== null && directionOf(p.amount) === "in"
                                ? "text-teal-700 dark:text-teal-300"
                                : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {p.amount === null
                              ? "—"
                              : `${directionOf(p.amount) === "in" ? "+" : "−"}€${Math.abs(p.amount).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-1.5">
                            {p.valid ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <select
                                  value={rowPot[i] ?? targetPot}
                                  onChange={(e) => {
                                    const next = [...rowPot];
                                    next[i] = e.target.value;
                                    setRowPot(next);
                                  }}
                                  className="max-w-[9rem] rounded-md border border-navy-200 bg-white px-1.5 py-1 text-xs dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
                                >
                                  {allowUnallocated && (
                                    <option value={UNALLOCATED}>Onverdeeld</option>
                                  )}
                                  {pots.map((pot) => (
                                    <option key={pot.id} value={pot.id}>
                                      {pot.name}
                                    </option>
                                  ))}
                                </select>
                                {suggested && (
                                  <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400">
                                    ✨ voorstel
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-navy-300 dark:text-navy-600">—</span>
                            )}
                          </td>
                        </tr>
                        {dup && openDup === i && (
                          <tr className="bg-canvas dark:bg-navy-800/50">
                            <td />
                            <td colSpan={4} className="px-3 pb-2.5 pt-0">
                              <DupVergelijking
                                bestaand={{
                                  datum: dup.existing.occurredOn,
                                  bedrag: dup.existing.amount,
                                  tegenpartij: dup.existing.counterparty,
                                  mededeling: dup.existing.memo,
                                  potje: potNaam(dup.existing.potId),
                                }}
                                importrij={{
                                  datum: p.occurredOn ?? "",
                                  bedrag: Math.abs(p.amount ?? 0),
                                  tegenpartij: p.counterparty,
                                  mededeling: p.memo,
                                  potje: potNaam(
                                    gekozen === UNALLOCATED ? null : gekozen,
                                  ),
                                }}
                              />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {preview.length > 50 && (
                  <div className="border-t border-navy-100 px-3 py-2 text-[11px] text-navy-400 dark:border-navy-700/60 dark:text-navy-500">
                    + {preview.length - 50} rijen meer , die volgen het potje voor
                    alle rijen.
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>

        {step === "map" && !result && (
          <div className="flex flex-col gap-2 border-t border-navy-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:pb-4 dark:border-navy-700/60">
            <button
              onClick={onClose}
              className="min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-navy-500 hover:bg-navy-50 sm:min-h-0 dark:text-navy-300 dark:hover:bg-navy-800"
            >
              Annuleren
            </button>
            <button
              onClick={() => runImport(importIndexes)}
              disabled={!canImport}
              className="min-h-11 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
            >
              {busy
                ? "Importeren…"
                : skippedCount > 0
                  ? `${importCount} importeren, ${skippedCount} overslaan`
                  : `${importCount} importeren`}
            </button>
          </div>
        )}

        {/* Afloop: wat er binnen is, en de kans om overgeslagen rijen alsnog te
            halen. Zonder dit moet je het bestand opnieuw kiezen voor één rij. */}
        {result && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 dark:border-navy-700/60">
            <p className="text-sm text-navy-700 dark:text-navy-200">
              <span className="font-semibold">{result.imported}</span>{" "}
              {result.imported === 1 ? "transactie" : "transacties"} geïmporteerd
              {result.skipped.length > 0 && (
                <>
                  {", "}
                  <span className="font-semibold">{result.skipped.length}</span>{" "}
                  overgeslagen als duplicaat
                </>
              )}
              .
            </p>
            <div className="flex gap-2">
              {result.skipped.length > 0 && (
                <button
                  onClick={() => runImport(result.skipped)}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-900/30"
                >
                  {busy ? "Bezig…" : "Toch importeren"}
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 dark:bg-white dark:text-navy-900 dark:hover:bg-navy-100"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Vergelijking bij een herkend duplicaat
// =============================================================================
// Bij een exacte match zijn datum, bedrag en richting per definitie gelijk. Wat
// kán verschillen is de tegenpartij, de mededeling en het potje. Precies dat
// bepaalt of je hier met een tweede import zit of met een echte tweede
// verrichting, dus het hoort zichtbaar te zijn en niet in een tooltip.

type VergelijkRij = {
  datum: string;
  bedrag: number;
  tegenpartij: string;
  mededeling: string;
  potje: string;
};

function DupVergelijking({
  bestaand,
  importrij,
}: {
  bestaand: VergelijkRij;
  importrij: VergelijkRij;
}) {
  const velden: { label: string; a: string; b: string; anders: boolean }[] = [
    {
      label: "Datum",
      a: bestaand.datum,
      b: importrij.datum,
      anders: bestaand.datum !== importrij.datum,
    },
    {
      label: "Bedrag",
      a: `€ ${bestaand.bedrag.toFixed(2)}`,
      b: `€ ${importrij.bedrag.toFixed(2)}`,
      anders:
        Math.round(bestaand.bedrag * 100) !== Math.round(importrij.bedrag * 100),
    },
    {
      label: "Tegenpartij",
      a: bestaand.tegenpartij,
      b: importrij.tegenpartij,
      // Anders geschreven is niet anders: "AG INSURANCE NV" en "AG Insurance"
      // zijn dezelfde partij, dat hoeft geen nadruk.
      anders: !sameParty(
        normalizeCounterparty(importrij.tegenpartij),
        bestaand.tegenpartij,
      ),
    },
    {
      label: "Mededeling",
      a: bestaand.mededeling,
      b: importrij.mededeling,
      anders: bestaand.mededeling.trim() !== importrij.mededeling.trim(),
    },
    {
      label: "Potje",
      a: bestaand.potje,
      b: importrij.potje,
      anders: bestaand.potje !== importrij.potje,
    },
  ];

  return (
    <div className="rounded-lg border border-navy-100 bg-white text-[11px] dark:border-navy-700 dark:bg-navy-900">
      <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-x-3 border-b border-navy-100 px-3 py-1.5 font-semibold uppercase tracking-wider text-navy-400 dark:border-navy-700 dark:text-navy-500">
        <span />
        <span>Al in Kaspio</span>
        <span>Dit bestand</span>
      </div>
      {velden.map((v) => (
        <div
          key={v.label}
          className="grid grid-cols-[5.5rem_1fr_1fr] gap-x-3 px-3 py-1"
        >
          <span className="text-navy-400 dark:text-navy-500">{v.label}</span>
          <span
            className={`truncate ${
              v.anders
                ? "text-navy-700 dark:text-navy-200"
                : "text-navy-400 dark:text-navy-500"
            }`}
            title={v.a}
          >
            {v.a || "—"}
          </span>
          <span
            className={`truncate ${
              v.anders
                ? "font-semibold text-amber-700 dark:text-amber-300"
                : "text-navy-400 dark:text-navy-500"
            }`}
            title={v.b}
          >
            {v.b || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
