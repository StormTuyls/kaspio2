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
