import type { Pot, Transaction } from "./types";

function escapeCell(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRow(values: string[]): string {
  return values.map(escapeCell).join(";");
}

export function exportPotCsv(pot: Pot, transactions: Transaction[]) {
  const sorted = [...transactions].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  const header = ["Datum", "Type", "Bedrag", "Tegenpartij", "Memo"];
  const lines = [
    toRow(header),
    ...sorted.map((t) =>
      toRow([
        t.occurredOn,
        t.direction === "in" ? "Inkomend" : "Uitgaand",
        t.amount.toFixed(2).replace(".", ","),
        t.counterparty,
        t.memo ?? "",
      ]),
    ),
  ];

  downloadCsv(lines, `${slugify(pot.name)}-transacties.csv`);
}

function downloadCsv(lines: string[], filename: string) {
  // BOM so Excel detects UTF-8
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Gedeelde print-stijl voor de org-brede PDF's (rapport + geschiedenis). */
const REPORT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a18; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2.sec { font-size: 15px; margin: 32px 0 10px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
  h3.dt { font-size: 13px; margin: 18px 0 6px; }
  .sub { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
  .totals { display: flex; gap: 16px; margin: 0 0 20px; flex-wrap: wrap; }
  .tot { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; min-width: 130px; }
  .tot .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; }
  .tot .val { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 4px; }
  th { text-align: left; border-bottom: 2px solid #1a1a18; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  tfoot td { font-weight: 700; border-top: 2px solid #1a1a18; border-bottom: none; }
  .foot { margin-top: 24px; color: #9ca3af; font-size: 11px; }
  @media print {
    body { margin: 0; }
    @page { margin: 16mm; }
    h2.sec, h3.dt { page-break-after: avoid; }
    table { page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

/** Genereert een nette PDF van een potje via het printvenster (geen extra
 *  dependency). De gebruiker kiest "Bewaar als PDF". Pro+ feature. */
export function exportPotPdf(pot: Pot, transactions: Transaction[]) {
  const sorted = [...transactions].sort((a, b) =>
    a.occurredOn.localeCompare(b.occurredOn),
  );
  const totalIn = sorted
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = sorted
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIn - totalOut;

  const rows = sorted
    .map((t) => {
      const sign = t.direction === "in" ? "+" : "-";
      const color = t.direction === "in" ? "#059669" : "#e11d48";
      return `<tr>
        <td>${escapeHtml(t.occurredOn)}</td>
        <td>${escapeHtml(t.counterparty ?? "")}</td>
        <td>${escapeHtml(t.memo ?? "")}</td>
        <td style="text-align:right;color:${color};font-variant-numeric:tabular-nums;white-space:nowrap;">${sign}${fmtEuro(t.amount)}</td>
      </tr>`;
    })
    .join("");

  const generated = new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(
    new Date(),
  );

  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8" />
<title>${escapeHtml(pot.name)} , Kaspio</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a18; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
  .totals { display: flex; gap: 24px; margin: 0 0 24px; }
  .tot { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
  .tot .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; }
  .tot .val { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; border-bottom: 2px solid #1a1a18; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  .foot { margin-top: 24px; color: #9ca3af; font-size: 11px; }
  @media print { body { margin: 0; } @page { margin: 18mm; } }
</style></head><body>
  <h1>${escapeHtml(pot.name)}</h1>
  <p class="sub">Transactie-overzicht , gegenereerd op ${generated} via Kaspio</p>
  <div class="totals">
    <div class="tot"><div class="lbl">Saldo</div><div class="val">${fmtEuro(balance)}</div></div>
    <div class="tot"><div class="lbl">Inkomend</div><div class="val" style="color:#059669">${fmtEuro(totalIn)}</div></div>
    <div class="tot"><div class="lbl">Uitgaand</div><div class="val" style="color:#e11d48">${fmtEuro(totalOut)}</div></div>
  </div>
  <table>
    <thead><tr><th>Datum</th><th>Tegenpartij</th><th>Memo</th><th style="text-align:right">Bedrag</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="color:#9ca3af;padding:24px;text-align:center">Nog geen transacties.</td></tr>`}</tbody>
  </table>
  <p class="foot">Kaspio , virtuele potjes op één bankrekening</p>
</body></html>`;

  openPrintWindow(html);
}

/** Naam van het potje waar een allocatie in zit, met nette val-terug. */
function potLabel(pots: Pot[], potId: string | null): string {
  if (potId === null) return "Onverdeeld / overig";
  return pots.find((p) => p.id === potId)?.name ?? "Onverdeeld / overig";
}

/**
 * Chronologische transactietabel over meerdere potjes heen. Gedeeld door de
 * losse geschiedenis-PDF en de org-brede sectie in het financieel rapport,
 * zodat beide er identiek uitzien.
 */
function historyTableHtml(transactions: Transaction[], pots: Pot[]): string {
  const sorted = [...transactions].sort((a, b) => {
    const d = a.occurredOn.localeCompare(b.occurredOn);
    return d !== 0 ? d : a.counterparty.localeCompare(b.counterparty);
  });
  const rows = sorted
    .map((t) => {
      const sign = t.direction === "in" ? "+" : "-";
      const color = t.direction === "in" ? "#059669" : "#e11d48";
      return `<tr>
        <td style="white-space:nowrap">${escapeHtml(t.occurredOn)}</td>
        <td>${escapeHtml(potLabel(pots, t.potId))}</td>
        <td>${escapeHtml(t.counterparty ?? "")}</td>
        <td>${escapeHtml(t.memo ?? "")}</td>
        <td style="text-align:right;color:${color};font-variant-numeric:tabular-nums;white-space:nowrap">${sign}${fmtEuro(t.amount)}</td>
      </tr>`;
    })
    .join("");
  return `<table>
    <thead><tr><th>Datum</th><th>Potje</th><th>Tegenpartij</th><th>Memo</th><th style="text-align:right">Bedrag</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="color:#9ca3af;padding:24px;text-align:center">Geen transacties in deze periode.</td></tr>`}</tbody>
  </table>`;
}

/**
 * CSV van een (gefilterde) transactielijst over meerdere potjes. Anders dan
 * exportPotCsv staat het potje hier wél als kolom in.
 */
export function exportTransactionsCsv(
  transactions: Transaction[],
  pots: Pot[],
  filenameHint = "transacties",
) {
  const sorted = [...transactions].sort((a, b) =>
    a.occurredOn.localeCompare(b.occurredOn),
  );

  const header = ["Datum", "Potje", "Type", "Bedrag", "Tegenpartij", "Memo"];
  const lines = [
    toRow(header),
    ...sorted.map((t) =>
      toRow([
        t.occurredOn,
        potLabel(pots, t.potId),
        t.direction === "in" ? "Inkomend" : "Uitgaand",
        t.amount.toFixed(2).replace(".", ","),
        t.counterparty,
        t.memo ?? "",
      ]),
    ),
  ];

  downloadCsv(lines, `${slugify(filenameHint)}.csv`);
}

export type TransactionHistoryPdfOptions = {
  orgName: string;
  /** Mensvriendelijk label van de periode, bv. "2026" of "alle transacties". */
  periodLabel: string;
  /** Extra beschrijving van de actieve filters, bv. "Potje: Jeugdwerking". */
  scopeLabel?: string;
  transactions: Transaction[];
  pots: Pot[];
};

/**
 * PDF (via printvenster) van een gefilterde transactiegeschiedenis. Toont wat
 * er op de transactiepagina staat, inclusief de actieve filters in de kop.
 */
export function exportTransactionHistoryPdf(opts: TransactionHistoryPdfOptions) {
  const { orgName, periodLabel, scopeLabel, transactions, pots } = opts;

  const totalIn = transactions
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const result = totalIn - totalOut;

  const generated = new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(
    new Date(),
  );

  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8" />
<title>${escapeHtml(orgName)} , transactiegeschiedenis , Kaspio</title>
<style>${REPORT_CSS}</style></head><body>
  <h1>${escapeHtml(orgName)}</h1>
  <p class="sub">Transactiegeschiedenis , ${escapeHtml(periodLabel)}${
    scopeLabel ? ` , ${escapeHtml(scopeLabel)}` : ""
  } , gegenereerd op ${generated} via Kaspio</p>
  <div class="totals">
    <div class="tot"><div class="lbl">Inkomend</div><div class="val" style="color:#059669">${fmtEuro(totalIn)}</div></div>
    <div class="tot"><div class="lbl">Uitgaand</div><div class="val" style="color:#e11d48">${fmtEuro(totalOut)}</div></div>
    <div class="tot"><div class="lbl">Resultaat</div><div class="val">${result >= 0 ? "+" : "-"}${fmtEuro(Math.abs(result))}</div></div>
    <div class="tot"><div class="lbl">Aantal</div><div class="val">${transactions.length}</div></div>
  </div>
  ${historyTableHtml(transactions, pots)}
  <p class="foot">Kaspio , virtuele potjes op één bankrekening</p>
</body></html>`;

  openPrintWindow(html);
}

export type OrgReportOptions = {
  orgName: string;
  /** Mensvriendelijk label, bv. "2026" of "1 jan 2026 , 31 dec 2026". */
  periodLabel: string;
  /** Inclusieve grenzen (YYYY-MM-DD). null = geen ondergrens / bovengrens. */
  start: string | null;
  end: string | null;
  pots: Pot[];
  transactions: Transaction[];
  /** Voeg per potje de transactielijst toe. */
  includeDetails: boolean;
  /**
   * Voeg één chronologische lijst toe van alle transacties van de organisatie
   * in de periode, met het potje als kolom. Staat los van includeDetails.
   */
  includeHistory?: boolean;
};

/**
 * Org-breed financieel rapport (PDF via printvenster). Voor de penningmeester
 * en de AV: totalen + resultaat per potje over een periode, optioneel met
 * transactiedetails. Pro+ feature ("Grafieken & rapportage" op de landing).
 */
export function exportOrgReport(opts: OrgReportOptions) {
  const {
    orgName,
    periodLabel,
    start,
    end,
    pots,
    includeDetails,
    includeHistory = false,
  } = opts;

  // Enkel goedgekeurde transacties tellen mee (pending niet, net als het saldo).
  const approved = opts.transactions.filter((t) => t.status !== "pending");
  const inPeriod = (d: string) =>
    (start === null || d >= start) && (end === null || d <= end);

  // Saldo t/m einde periode (of all-time als er geen einddatum is).
  const balanceUpTo = (potId: string | null) =>
    approved
      .filter((t) => t.potId === potId && (end === null || t.occurredOn <= end))
      .reduce((s, t) => s + (t.direction === "in" ? t.amount : -t.amount), 0);

  // Groepeer per potje-id (plus null = onverdeeld/overig).
  type Line = { name: string; in: number; out: number; balance: number; potId: string | null };
  const known = new Set(pots.map((p) => p.id));
  const lines: Line[] = [];

  const summarise = (potId: string | null, name: string): Line => {
    const txs = approved.filter((t) => t.potId === potId && inPeriod(t.occurredOn));
    const tin = txs.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const tout = txs.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    return { name, in: tin, out: tout, balance: balanceUpTo(potId), potId };
  };

  for (const p of pots) lines.push(summarise(p.id, p.name));
  // Transacties zonder (bestaand) potje: onverdeeld + verweesde pot-ids.
  const hasOrphan = approved.some(
    (t) => t.potId === null || (t.potId !== null && !known.has(t.potId)),
  );
  if (hasOrphan) {
    const txs = approved.filter(
      (t) =>
        (t.potId === null || !known.has(t.potId)) && inPeriod(t.occurredOn),
    );
    const tin = txs.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const tout = txs.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    const bal = approved
      .filter(
        (t) =>
          (t.potId === null || !known.has(t.potId)) &&
          (end === null || t.occurredOn <= end),
      )
      .reduce((s, t) => s + (t.direction === "in" ? t.amount : -t.amount), 0);
    lines.push({ name: "Onverdeeld / overig", in: tin, out: tout, balance: bal, potId: null });
  }

  const totalIn = lines.reduce((s, l) => s + l.in, 0);
  const totalOut = lines.reduce((s, l) => s + l.out, 0);
  const totalBalance = lines.reduce((s, l) => s + l.balance, 0);
  const result = totalIn - totalOut;

  const potRows = lines
    .map(
      (l) => `<tr>
        <td>${escapeHtml(l.name)}</td>
        <td style="text-align:right;color:#059669;font-variant-numeric:tabular-nums">${fmtEuro(l.in)}</td>
        <td style="text-align:right;color:#e11d48;font-variant-numeric:tabular-nums">${fmtEuro(l.out)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${l.in - l.out >= 0 ? "+" : "-"}${fmtEuro(Math.abs(l.in - l.out))}</td>
        <td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${fmtEuro(l.balance)}</td>
      </tr>`,
    )
    .join("");

  // Optionele details per potje.
  let detailsHtml = "";
  if (includeDetails) {
    const potName = (id: string | null) =>
      id === null ? "Onverdeeld / overig" : (pots.find((p) => p.id === id)?.name ?? "Onverdeeld / overig");
    const blocks = lines
      .map((l) => {
        const txs = approved
          .filter((t) => {
            const belongs =
              l.potId === null
                ? t.potId === null || !known.has(t.potId ?? "")
                : t.potId === l.potId;
            return belongs && inPeriod(t.occurredOn);
          })
          .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
        if (txs.length === 0) return "";
        const rows = txs
          .map((t) => {
            const sign = t.direction === "in" ? "+" : "-";
            const color = t.direction === "in" ? "#059669" : "#e11d48";
            return `<tr>
              <td>${escapeHtml(t.occurredOn)}</td>
              <td>${escapeHtml(t.counterparty ?? "")}</td>
              <td>${escapeHtml(t.memo ?? "")}</td>
              <td style="text-align:right;color:${color};font-variant-numeric:tabular-nums;white-space:nowrap">${sign}${fmtEuro(t.amount)}</td>
            </tr>`;
          })
          .join("");
        return `<h3 class="dt">${escapeHtml(potName(l.potId))}</h3>
          <table><thead><tr><th>Datum</th><th>Tegenpartij</th><th>Memo</th><th style="text-align:right">Bedrag</th></tr></thead>
          <tbody>${rows}</tbody></table>`;
      })
      .join("");
    if (blocks) detailsHtml = `<h2 class="sec">Transactiedetails</h2>${blocks}`;
  }

  // Org-brede, chronologische transactiegeschiedenis. Eén tabel over alle
  // potjes heen, zodat je de rekening op datum kan volgen in plaats van per
  // potje te moeten springen.
  let historyHtml = "";
  if (includeHistory) {
    const txs = approved.filter((t) => inPeriod(t.occurredOn));
    historyHtml = `<h2 class="sec">Transactiegeschiedenis , hele organisatie (${txs.length})</h2>${historyTableHtml(
      txs,
      pots,
    )}`;
  }

  const generated = new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(
    new Date(),
  );

  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8" />
<title>${escapeHtml(orgName)} , financieel overzicht , Kaspio</title>
<style>${REPORT_CSS}</style></head><body>
  <h1>${escapeHtml(orgName)}</h1>
  <p class="sub">Financieel overzicht , ${escapeHtml(periodLabel)} , gegenereerd op ${generated} via Kaspio</p>
  <div class="totals">
    <div class="tot"><div class="lbl">Inkomsten</div><div class="val" style="color:#059669">${fmtEuro(totalIn)}</div></div>
    <div class="tot"><div class="lbl">Uitgaven</div><div class="val" style="color:#e11d48">${fmtEuro(totalOut)}</div></div>
    <div class="tot"><div class="lbl">Resultaat periode</div><div class="val">${result >= 0 ? "+" : "-"}${fmtEuro(Math.abs(result))}</div></div>
    <div class="tot"><div class="lbl">Eindsaldo</div><div class="val">${fmtEuro(totalBalance)}</div></div>
  </div>
  <h2 class="sec">Per potje</h2>
  <table>
    <thead><tr><th>Potje</th><th style="text-align:right">Inkomsten</th><th style="text-align:right">Uitgaven</th><th style="text-align:right">Resultaat</th><th style="text-align:right">Eindsaldo</th></tr></thead>
    <tbody>${potRows || `<tr><td colspan="5" style="color:#9ca3af;padding:24px;text-align:center">Geen transacties in deze periode.</td></tr>`}</tbody>
    <tfoot><tr>
      <td>Totaal</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtEuro(totalIn)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtEuro(totalOut)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${result >= 0 ? "+" : "-"}${fmtEuro(Math.abs(result))}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtEuro(totalBalance)}</td>
    </tr></tfoot>
  </table>
  ${detailsHtml}
  ${historyHtml}
  <p class="foot">Kaspio , virtuele potjes op één bankrekening</p>
</body></html>`;

  openPrintWindow(html);
}

/**
 * Open een nieuw venster met de meegegeven HTML en trigger het printdialoog
 * vanuit dít venster (geen inline script in de popup, zodat een strikte CSP
 * niet in de weg zit).
 */
function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  try {
    w.focus();
  } catch {
    // niet kritisch
  }
  setTimeout(() => {
    try {
      w.print();
    } catch {
      // popup kan gesloten zijn; geen probleem
    }
  }, 350);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "potje"
  );
}
