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

  // BOM so Excel detects UTF-8
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(pot.name)}-transacties.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
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
