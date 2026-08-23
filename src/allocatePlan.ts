// =============================================================================
// Verdeel-planner , welke onverdeelde transactie gaat naar welk potje
// =============================================================================
// Verdelen maakte vroeger een tegenboeking op de hoofdpot plus een 'in' per
// potje. De onderliggende transacties bleven daarbij op pot_id null staan, dus
// ze bleven in de inbox hangen. Wees je ze daarna alsnog toe, dan telde
// hetzelfde geld twee keer en zakte de hoofdpot onder nul.
//
// Het hoofdpotsaldo ís de som van die transacties, dus verdelen hoort ze
// gewoon toe te wijzen. Deze module rekent uit hoe: greedy vullen op volgorde
// van datum, splitsen waar een transactie over twee potjes valt. Zo blijft het
// aantal extra rijen minimaal en klopt het spoor naar het origineel.
//
// Puur rekenwerk, zonder Supabase, zodat het te testen is.
// =============================================================================

/** Een onverdeelde inkomst die verdeeld kan worden. */
export type PoolTx = {
  id: string;
  /** Bedrag in euro. Altijd positief; enkel 'in'-regels komen in de pool. */
  amount: number;
};

export type Allocation = { toPotId: string; amount: number };

/** De originele rij krijgt deel 1 en gaat naar dit potje. */
export type PlanUpdate = { txId: string; potId: string; amount: number };

/** Extra rij voor deel 2..n, met trace naar het origineel. */
export type PlanInsert = { splitFrom: string; potId: string; amount: number };

export type AllocationPlan = {
  updates: PlanUpdate[];
  inserts: PlanInsert[];
  /**
   * Wat er niet uit de pool gedekt kon worden. Gebeurt als het hoofdpotsaldo
   * niet volledig uit onverdeelde inkomsten bestaat, bijvoorbeeld bij een org
   * die eerder al met de oude tegenboeking verdeeld heeft. Hiervoor valt de
   * aanroeper terug op de klassieke transfer-regels.
   */
  remainder: number;
};

/** Centen, om afrondingsruis in floats te vermijden. */
const cents = (v: number) => Math.round(v * 100);
const euro = (c: number) => c / 100;

/**
 * Verdeel `allocations` over `pool`, oudste transactie eerst.
 *
 * Elke transactie wordt hoogstens één keer ge-update (deel 1) en verder
 * gesplitst met extra rijen. Bedragen worden in centen gerekend, zodat de som
 * van de delen exact het origineel is.
 */
export function planAllocation(
  pool: PoolTx[],
  allocations: Allocation[],
): AllocationPlan {
  const wanted = allocations
    .filter((a) => a.toPotId && Number.isFinite(a.amount) && a.amount > 0)
    .map((a) => ({ potId: a.toPotId, left: cents(a.amount) }));

  const rest = pool
    .filter((t) => Number.isFinite(t.amount) && cents(t.amount) > 0)
    .map((t) => ({ id: t.id, left: cents(t.amount), claimed: false }));

  const updates: PlanUpdate[] = [];
  const inserts: PlanInsert[] = [];

  let ti = 0;
  for (const want of wanted) {
    while (want.left > 0 && ti < rest.length) {
      const tx = rest[ti];
      if (tx.left === 0) {
        ti++;
        continue;
      }
      const take = Math.min(tx.left, want.left);
      // Deel 1 van een transactie werkt de originele rij bij, de rest wordt een
      // nieuwe rij. Zo blijft het id van het origineel stabiel.
      if (!tx.claimed) {
        updates.push({ txId: tx.id, potId: want.potId, amount: euro(take) });
        tx.claimed = true;
      } else {
        inserts.push({ splitFrom: tx.id, potId: want.potId, amount: euro(take) });
      }
      tx.left -= take;
      want.left -= take;
      if (tx.left === 0) ti++;
    }
  }

  const remainder = wanted.reduce((s, w) => s + w.left, 0);
  return { updates, inserts, remainder: euro(remainder) };
}

/**
 * Som van de pool. Handig om vooraf te tonen hoeveel er via de inbox gedekt is.
 */
export function poolTotal(pool: PoolTx[]): number {
  return euro(pool.reduce((s, t) => s + cents(t.amount), 0));
}

/** Minimale vorm van een DB-rij die deze module nodig heeft. */
export type PoolCandidate = {
  id: string;
  pot_id: string | null;
  transfer_group?: string | null;
  direction: string;
  occurred_on: string;
  amount: number | string;
};

/**
 * De verdeelbare pool: onverdeelde inkomsten, oudste eerst.
 *
 * Uitgaven zonder potje horen er niet bij (die halen geld weg, ze leveren
 * niets op om te verdelen) en transfer-regels evenmin: die horen bij een
 * tegenboeking op een potje.
 */
export function buildPool(rows: PoolCandidate[]): PoolTx[] {
  return rows
    .filter(
      (t) => t.pot_id === null && !t.transfer_group && t.direction === "in",
    )
    .slice()
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
    .map((t) => ({ id: t.id, amount: Number(t.amount) }))
    .filter((t) => Number.isFinite(t.amount) && t.amount > 0);
}

/**
 * Wat er per potje nog openstaat nadat de pool zijn deel gedaan heeft. Enkel
 * relevant als `plan.remainder > 0`; hiervoor valt de aanroeper terug op de
 * klassieke transfer-regels.
 */
export function leftoverAllocations(
  allocations: Allocation[],
  plan: AllocationPlan,
): Allocation[] {
  const covered = new Map<string, number>();
  for (const x of [...plan.updates, ...plan.inserts]) {
    covered.set(x.potId, (covered.get(x.potId) ?? 0) + cents(x.amount));
  }
  return allocations
    .filter((a) => a.toPotId && Number.isFinite(a.amount) && a.amount > 0)
    .map((a) => ({
      toPotId: a.toPotId,
      amount: euro(cents(a.amount) - (covered.get(a.toPotId) ?? 0)),
    }))
    .filter((a) => a.amount > 0);
}
