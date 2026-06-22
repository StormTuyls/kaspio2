// =============================================================================
// CSV-import , parser voor bankafschriften (Pro-feature)
// =============================================================================
// Generieke CSV-parser: detecteert scheidingsteken, leest met quote-handling,
// en normaliseert datums/bedragen uit Belgische/Nederlandse bankexports.
// Volledig client-side, geen dependency.

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

/** Detecteer het scheidingsteken op basis van de eerste (header-)regel. */
function detectDelimiter(firstLine: string): string {
  const candidates = [";", "\t", ","];
  let best = ";";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Parse CSV-tekst naar rijen van cellen (quote-aware, "" = escaped quote). */
export function parseCsv(text: string): ParsedCsv {
  // BOM weg + normaliseer line endings.
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstNewline = clean.indexOf("\n");
  const firstLine = firstNewline === -1 ? clean : clean.slice(0, firstNewline);
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // Laatste veld/rij (geen trailing newline).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Lege regels eruit.
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty.slice(1), delimiter };
}

/**
 * Parse een bedrag uit diverse formaten: "1.234,56", "1,234.56", "-12,50",
 * "€ 12,50", "12.50". Returnt een (mogelijk negatief) getal of null.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[€$£\s]/g, "");
  if (s === "") return null;

  // Negatief via voorloop-min of haakjes (boekhoud-stijl).
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Laatste scheidingsteken is de decimaal; de andere zijn duizendtallen.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Enkel komma -> decimaalteken (EU).
    s = s.replace(",", ".");
  }
  // Enkel punt: al in JS-formaat.

  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

/**
 * Parse een datum naar YYYY-MM-DD. Ondersteunt DD/MM/YYYY, DD-MM-YYYY,
 * DD.MM.YYYY en ISO (YYYY-MM-DD). Returnt null bij twijfel.
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO: YYYY-MM-DD (evt. met tijd erachter).
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY met / . of - als scheiding.
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    if (Number(mm) > 12) return null; // duidelijk geen DD/MM
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

export type ColumnKey = "date" | "amount" | "counterparty" | "memo";

/** Raad welke kolom-index bij welk veld hoort op basis van de header-naam. */
export function guessColumns(headers: string[]): Record<ColumnKey, number> {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (patterns: RegExp[]): number => {
    for (let i = 0; i < lower.length; i++) {
      if (patterns.some((p) => p.test(lower[i]))) return i;
    }
    return -1;
  };
  return {
    date: find([/datum/, /date/, /boekdatum/, /valuta/]),
    amount: find([/bedrag/, /amount/, /som/, /mutatie/]),
    counterparty: find([/tegenpartij/, /naam/, /begunstigde/, /counterpart/, /payee/]),
    memo: find([/mededeling/, /omschrijving/, /memo/, /communicatie/, /detail/, /description/]),
  };
}
