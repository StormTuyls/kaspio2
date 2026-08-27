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

export type ColumnKey =
  | "date"
  | "amount"
  | "counterparty"
  | "memo"
  | "pot"
  | "account"
  | "counterpartyAccount";

/** Noemt deze header expliciet de tegenpartij (en dus niet je eigen kant)? */
function mentionsCounterparty(header: string): boolean {
  return /tegenpartij|begunstigde|counterpart|payee/.test(header);
}

/** Ziet deze header uit als een rekeningnummer-kolom? */
function isAccountHeader(header: string): boolean {
  return /rekeningnummer|rekening nr|iban/.test(header);
}

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
    // Potje/post: alleen expliciete kopjes. Geen los /post/, want dat matcht
    // "postcode".
    pot: find([
      /potje/,
      /budgetpost/,
      /kostenpost/,
      /^\s*post(en)?\s*$/,
      /categorie/,
      /rubriek/,
    ]),
    // Eigen rekening en tegenpartij-rekening. Bankexports zijn hier slordig:
    // sommige (o.a. de KBC-export waar dit op getest is) noemen BEIDE kolommen
    // gewoon "REKENINGNUMMER". Vandaar de volgorde-afspraak hieronder in
    // guessAccountColumns: de eerste rekeningkolom is de jouwe, de volgende is
    // die van de tegenpartij.
    ...guessAccountColumns(lower),
  };
}

/**
 * Raad de twee rekeningkolommen: die van jou en die van de tegenpartij.
 *
 * Eerst op naam, want een header die "tegenpartij" of "begunstigde" noemt is
 * ondubbelzinnig. Staan de kolommen niet zo gelabeld (of heten ze allebei
 * hetzelfde), dan valt het terug op positie: de eerste rekeningkolom is de
 * rekening waarop de verrichting stond, de volgende is de andere kant. Dat is
 * de volgorde die elke bankexport die we zagen aanhoudt.
 */
function guessAccountColumns(lower: string[]): {
  account: number;
  counterpartyAccount: number;
} {
  const accountCols = lower
    .map((h, i) => (isAccountHeader(h) ? i : -1))
    .filter((i) => i >= 0);
  if (accountCols.length === 0) return { account: -1, counterpartyAccount: -1 };

  const named = accountCols.filter((i) => mentionsCounterparty(lower[i]));
  const unnamed = accountCols.filter((i) => !mentionsCounterparty(lower[i]));

  // Duidelijk gelabeld: eigen kant is de eerste zonder "tegenpartij" erin.
  if (named.length > 0 && unnamed.length > 0) {
    return { account: unnamed[0], counterpartyAccount: named[0] };
  }
  // Alleen tegenpartij-kolommen: dan weten we onze eigen rekening niet.
  if (unnamed.length === 0) {
    return { account: -1, counterpartyAccount: named[0] };
  }
  // Geen labels: op positie.
  return {
    account: unnamed[0],
    counterpartyAccount: unnamed.length > 1 ? unnamed[1] : -1,
  };
}

// =============================================================================
// Potje uit het bestand
// =============================================================================
// Wie zijn verrichtingen al jaren in Excel per post sorteert, heeft die
// categorisering al gedaan. Die willen we niet weggooien en hem 4000 keer laten
// herklikken, dus mag de import een kolom met de potnaam meekrijgen.
//
// De match is exact (op genormaliseerde naam) en bewust niet fuzzy. Bij een
// club met tientallen posten liggen namen dicht bij elkaar , "KOSTEN TRAINERS
// WINTER DEEL1" naast "DEEL2" , en een deelstring-match zet dan stilletjes
// duizenden euro's op de verkeerde post. Niet-herkende namen komen liever
// zichtbaar in de bulk-keuze terecht dan onzichtbaar op het verkeerde potje.
// =============================================================================

/** Normaliseer een potnaam voor vergelijking (kleine letters, één spatie). */
export function normalizePotName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Zoek het potje dat bij deze naam uit het bestand hoort. Exacte match op
 * genormaliseerde naam, anders null.
 */
export function matchPotByName(
  raw: string,
  pots: { id: string; name: string }[],
): string | null {
  const key = normalizePotName(raw);
  if (!key) return null;
  const hit = pots.find((p) => normalizePotName(p.name) === key);
  return hit ? hit.id : null;
}

// =============================================================================
// Duplicaatdetectie bij import
// =============================================================================
// Twee afschriften overlappen bijna altijd een stuk. Zonder controle boek je die
// overlap gewoon een tweede keer, en bij domiciliëringen valt dat het minst op:
// die zien er maand na maand identiek uit.
//
// De vergelijking negeert regels met een transferGroup die Kaspio zelf maakte:
// verdelingen, reserveringen en overboekingen tussen potjes. Dat zijn geen
// bankverrichtingen. Deed ze dat niet, dan werd je echte afhouding aangezien
// voor een duplicaat van de reservering die Kaspio er zelf voor klaarzette:
// zelfde bedrag, zelfde tegenpartij, datum vlakbij.
//
// Een geïmporteerde interne overboeking tussen twee eigen rekeningen heeft ook
// een transferGroup, maar is wél een bankverrichting. Die moet dus gewoon
// meedoen, anders importeer je ze een tweede keer bij een overlappend
// afschrift. Het onderscheid is bankAccount: dat staat alleen op regels die van
// een afschrift komen.
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
    memo: string;
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
    memo?: string;
    potId: string | null;
    transferGroup?: string | null;
    /** Gezet op regels die van een afschrift komen, niet op wat Kaspio maakte. */
    bankAccount?: string | null;
  }[],
  windowDays = 3,
): DuplicateHit | null {
  const cp = normalizeCounterparty(row.counterparty ?? "");
  let best: (DuplicateHit & { gap: number }) | null = null;

  for (const tx of existing) {
    // Interne Kaspio-regel: geen bankverrichting, dus geen duplicaat.
    if (tx.transferGroup && !tx.bankAccount) continue;
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
        memo: tx.memo ?? "",
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

// =============================================================================
// Interne overboekingen tussen eigen rekeningen
// =============================================================================
// Werkt een organisatie met meerdere rekeningen, dan schuift ze geld tussen die
// rekeningen heen en weer. Op het afschrift zijn dat twee verrichtingen: een
// afname op de ene rekening en een toename op de andere. Netto gebeurt er niets,
// maar geïmporteerd als twee losse regels blazen ze je in- en uitstroom op.
// Bij de club waar dit op getest is: 50 zulke regels in acht maanden, samen
// exact 0 euro, met bedragen tot 45.000.
//
// We herkennen ze als PAAR, niet los. Een regel waarvan de tegenpartijrekening
// een van je eigen rekeningen is, is een aanwijzing; een tegenboeking met
// hetzelfde bedrag en de rekeningen omgewisseld is een bewijs. Die eis is
// belangrijk: een derde die op twee van je rekeningen betaalt, of een rekening
// die per ongeluk als eigen rekening in het bestand staat, levert geen paar op
// en blijft dus een gewone verrichting.
//
// Beide benen krijgen bij import hetzelfde transfer_group. De frontend houdt
// regels met een transfer_group al buiten de in/uit-cashflow, dus daar is
// verder niets voor nodig.
// =============================================================================

/** Rekeningnummer normaliseren: geen spaties, hoofdletters. */
export function normalizeAccount(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

export type TransferCandidate = {
  /** Ondertekend bedrag zoals uit het bestand geparsed. */
  amount: number | null;
  occurredOn: string | null;
  /** Rekening waarop de verrichting stond. */
  account: string;
  /** Rekening van de tegenpartij. */
  counterpartyAccount: string;
};

/**
 * Zoek paren die samen één interne overboeking vormen.
 *
 * Returnt een array zo lang als `rows`: per rij de index van de tegenboeking,
 * of null wanneer de rij geen deel van een paar is. Elke rij wordt hoogstens
 * één keer gekoppeld; bij meerdere kandidaten wint de kleinste datumafstand.
 */
export function detectInternalTransfers(
  rows: TransferCandidate[],
  windowDays = 3,
): (number | null)[] {
  const partner: (number | null)[] = rows.map(() => null);

  const usable = rows.map((r) => {
    if (r.amount === null || r.amount === 0 || !r.occurredOn) return null;
    const own = normalizeAccount(r.account ?? "");
    const other = normalizeAccount(r.counterpartyAccount ?? "");
    if (!own || !other || own === other) return null;
    return { own, other, amount: r.amount, occurredOn: r.occurredOn };
  });

  for (let i = 0; i < usable.length; i++) {
    const a = usable[i];
    if (!a || partner[i] !== null) continue;

    let best = -1;
    let bestGap = Infinity;
    for (let j = i + 1; j < usable.length; j++) {
      const b = usable[j];
      if (!b || partner[j] !== null) continue;
      // Tegengesteld teken: één been af, één been bij.
      if (Math.sign(a.amount) === Math.sign(b.amount)) continue;
      if (!sameCents(a.amount, b.amount)) continue;
      // De rekeningen moeten omgewisseld zijn. Dit is de eigenlijke test.
      if (a.own !== b.other || a.other !== b.own) continue;
      const gap = dayGap(a.occurredOn, b.occurredOn);
      if (gap > windowDays) continue;
      if (gap < bestGap) {
        best = j;
        bestGap = gap;
      }
    }

    if (best >= 0) {
      partner[i] = best;
      partner[best] = i;
    }
  }

  return partner;
}
