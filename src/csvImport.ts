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

/**
 * Normaliseer een tegenpartij zodat kleine verschillen (hoofdletters, dubbele
 * spaties) hetzelfde matchen. Gebruikt om import-rijen te koppelen aan het
 * potje waar je eerdere transacties van dezelfde tegenpartij aan toewees.
 */
export function normalizeCounterparty(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
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
  // Probeer groepen op volgorde: de eerste groep die iets vindt, wint. Zo laten
  // we specifieke patronen (bv. "naam tegenpartij") voorgaan op generieke
  // ("naam"), wat anders op je eigen rekeningnaam botst (o.a. bij KBC).
  const findFirst = (...groups: RegExp[][]): number => {
    for (const g of groups) {
      const idx = find(g);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  return {
    // Boekdatum vóór valutadatum.
    date: findFirst([/boekdatum/, /datum/, /date/], [/valuta/]),
    amount: find([/bedrag/, /amount/, /som/, /mutatie/]),
    // Eerst een echte tegenpartij-/begunstigde-NAAM; dan een kolom die exact
    // "tegenpartij" heet (ons eigen voorbeeldformaat); pas daarna een generieke
    // naamkolom. "rekeningnummer/bic tegenpartij" worden bewust overgeslagen
    // (dat is geen naam), daarom matcht groep 2 exact en niet met /tegenpartij/.
    counterparty: findFirst(
      [
        /naam.*tegenpartij/,
        /tegenpartij.*naam/,
        /naam.*begunstigde/,
        /begunstigde/,
        /counterpart/,
        /payee/,
      ],
      [/^\s*tegenpartij\s*$/],
      [/naam/, /name/],
    ),
    memo: find([/mededeling/, /omschrijving/, /memo/, /communicatie/, /detail/, /description/]),
  };
}

// =============================================================================
// Duplicaatdetectie bij import
// =============================================================================
// Twee afschriften overlappen bijna altijd een stuk. Zonder controle boek je die
// overlap gewoon een tweede keer, en bij domiciliëringen valt dat het minst op:
// die zien er maand na maand identiek uit.
//
// De vergelijking negeert alle regels met een transferGroup. Dat zijn interne
// verschuivingen (verdelingen, reserveringen, overboekingen tussen potjes) en
// geen echte bankverrichtingen. Deed ze dat niet, dan werd je echte afhouding
// aangezien voor een duplicaat van de reservering die Kaspio er zelf voor
// klaarzette: zelfde bedrag, zelfde tegenpartij, datum vlakbij.
// =============================================================================

/** Hoe zeker is de match? 'exact' = veilig om standaard over te slaan. */
export type DuplicateKind = "exact" | "near";

export type DuplicateHit = {
  kind: DuplicateKind;
  /** De bestaande transactie waarop gematcht is. */
  existing: {
    id: string;
    occurredOn: string;
    amount: number;
    counterparty: string;
    potId: string | null;
  };
};

/** Dagen tussen twee ISO-datums (absoluut). */
function dayGap(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Infinity;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function sameCents(a: number, b: number): boolean {
  return Math.round(Math.abs(a) * 100) === Math.round(Math.abs(b) * 100);
}

/**
 * Zoek een bestaande transactie die overeenkomt met een importrij.
 *
 *   'exact' : zelfde datum, bedrag en richting. De tegenpartij speelt hier geen
 *             rol meer. Die eis kostte vooral gemiste duplicaten: een niet
 *             gemapte naamkolom of een andere schrijfwijze in een tweede export
 *             liet de rij gewoon door. Verschilt de naam wel, dan tonen we die
 *             van de bestaande transactie, zodat je zelf ziet dat er iets niet
 *             rijmt en de rij terug kan aanvinken.
 *   'near'  : bedrag en richting gelijk, datum binnen `windowDays`, én een
 *             tegenpartij die overeenkomt. Zonder die naam is "zelfde bedrag,
 *             datum een paar dagen ernaast" te mager om iets over te zeggen.
 *
 * Bij meerdere kandidaten wint de exacte, en daarna de kleinste datumafstand.
 */
export function findDuplicate(
  row: {
    occurredOn: string;
    amount: number;
    direction: "in" | "out";
    counterparty: string;
  },
  existing: {
    id: string;
    occurredOn: string;
    amount: number;
    direction: "in" | "out";
    counterparty?: string;
    potId: string | null;
    transferGroup?: string | null;
  }[],
  windowDays = 3,
): DuplicateHit | null {
  const cp = normalizeCounterparty(row.counterparty ?? "");
  let best: (DuplicateHit & { gap: number }) | null = null;

  for (const tx of existing) {
    if (tx.transferGroup) continue;
    if (tx.direction !== row.direction) continue;
    if (!sameCents(tx.amount, row.amount)) continue;

    const gap = dayGap(row.occurredOn, tx.occurredOn);
    if (gap > windowDays) continue;

    // Zelfde dag + zelfde bedrag is het sterkste signaal dat we hebben.
    // Daarbuiten moet de tegenpartij het verhaal bevestigen.
    const isExact = gap === 0;
    if (!isExact && !sameParty(cp, tx.counterparty)) continue;
    const kind: DuplicateKind = isExact ? "exact" : "near";

    const hit = {
      kind,
      gap,
      existing: {
        id: tx.id,
        occurredOn: tx.occurredOn,
        amount: Math.abs(tx.amount),
        counterparty: tx.counterparty ?? "",
        potId: tx.potId,
      },
    };
    if (
      !best ||
      (hit.kind === "exact" && best.kind !== "exact") ||
      (hit.kind === best.kind && hit.gap < best.gap)
    ) {
      best = hit;
    }
  }

  if (!best) return null;
  return { kind: best.kind, existing: best.existing };
}

/**
 * Slaan twee tegenpartijen op hetzelfde? Gelijk, of de ene zit in de andere
 * ("AG Insurance" in "AG INSURANCE NV"). Deelstrings pas vanaf vier tekens,
 * anders matcht "AG" op "AGENDA BVBA". Eén lege naam is geen bevestiging.
 */
export function sameParty(normalized: string, other: string | undefined): boolean {
  const b = normalizeCounterparty(other ?? "");
  if (!normalized || !b) return false;
  if (normalized === b) return true;
  const short = normalized.length <= b.length ? normalized : b;
  const long = short === normalized ? b : normalized;
  return short.length >= 4 && long.includes(short);
}
