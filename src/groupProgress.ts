// =============================================================================
// Budget en prognose van een groep
// =============================================================================
// potProgress.ts beantwoordt "hoe staat dit potje ervoor". Dit bestand doet
// hetzelfde een niveau hoger: hoe staat een hele groep ervoor, zonder dat je
// eerst vijftien potjes hoeft na te lopen.
//
// Dat is ook de volgorde waarin een bestuur kijkt. Eerst het comité: blijft het
// binnen wat we afgesproken hebben? Zo ja, klaar. Zo nee, dan pas de vraag welk
// potje het doet. Daarom levert de rollup naast de totalen meteen de potjes die
// het probleem veroorzaken, ergste eerst.
//
// Budget en spaardoel blijven gescheiden. Een uitgavenplafond van 500 en een
// doelsaldo van 500 zijn geen 1000: het eerste is een grens die je niet wil
// halen, het tweede een grens die je wél wil halen. Bij elkaar optellen geeft
// een getal dat niets betekent.
//
// Hier staat alleen de rekensom. Hoe het eruitziet staat in
// components/GroepBudget.tsx, zodat de groepenpagina en een groepsdetail niet
// elk hun eigen percentage kunnen gaan tonen.
// =============================================================================

import type { Pot, Transaction } from "./types";

/** Onder dit bedrag noemen we het geen verschil; centen zijn afrondingsruis. */
const EPS = 0.005;

/** ok = binnen plan, dreigt = prognose gaat eroverheen, over = al gebeurd. */
export type BudgetStand = "ok" | "dreigt" | "over";

export type GroepBudget = {
  /** Som van de budgetten, altijd als positief bedrag. */
  budget: number;
  /** Som van de goedgekeurde uitgaven op die potjes. */
  uitgegeven: number;
  /** Som van de prognoses. Een potje zonder prognose telt met zijn budget mee. */
  prognose: number;
  /** Prognose min budget. Positief = het gaat meer worden dan afgesproken. */
  verschil: number;
  potCount: number;
  pct: number;
  /** Breedte van de balk, 0-100. */
  barPct: number;
  stand: BudgetStand;
};

export type GroepDoel = {
  /** Som van de doelsaldi. Mag negatief zijn; zie potProgress.ts. */
  doel: number;
  saldo: number;
  prognose: number;
  /** Prognose min doel. Negatief = we komen tekort. */
  verschil: number;
  potCount: number;
  pct: number;
  barPct: number;
  /** De prognose haalt het doel niet. */
  tekort: boolean;
};

export type ProbleemPot = {
  pot: Pot;
  stand: Exclude<BudgetStand, "ok">;
  /** Het bedrag waar het om gaat: de overschrijding, of de dreigende. */
  overschrijding: number;
};

export type GroepRollup = {
  /** null = geen enkel budgetpotje in deze groep. */
  budget: GroepBudget | null;
  /** null = geen enkel spaardoel in deze groep. */
  doel: GroepDoel | null;
  /** De potjes achter een niet-ok budget, ergste eerst. */
  probleemPotjes: ProbleemPot[];
  /**
   * De stand van de groep. Enkel afgeleid van de budgetten: een spaardoel dat
   * nog niet gehaald is, is geen overschrijding maar werk dat loopt.
   */
  stand: BudgetStand;
};

/** Het budget van één potje als positief bedrag, of null: geen budgetpotje. */
function budgetVan(pot: Pot): number | null {
  if ((pot.targetKind ?? "saving") !== "budget") return null;
  const doel = pot.targetAmount;
  if (doel == null || !Number.isFinite(doel) || doel === 0) return null;
  return Math.abs(doel);
}

/** Het doelsaldo van één potje, of null: geen spaardoel. */
function doelVan(pot: Pot): number | null {
  if ((pot.targetKind ?? "saving") !== "saving") return null;
  const doel = pot.targetAmount;
  if (doel == null || !Number.isFinite(doel) || doel === 0) return null;
  return doel;
}

/** Geen prognose ingevuld = het budget of doel is nog steeds het plan. */
function prognoseVan(pot: Pot, terugval: number, absoluut: boolean): number {
  const prognose = pot.forecastAmount;
  if (prognose == null || !Number.isFinite(prognose)) return terugval;
  return absoluut ? Math.abs(prognose) : prognose;
}

/**
 * De stand van één budgetpotje, of null voor een potje zonder budget. Zo kan
 * een rij dit rechtstreeks gebruiken zonder eerst zelf uit te zoeken of het
 * potje er wel een heeft.
 */
export function potBudgetStand(pot: Pot, uitgegeven: number): BudgetStand | null {
  const budget = budgetVan(pot);
  if (budget === null) return null;
  if (uitgegeven - budget > EPS) return "over";
  if (prognoseVan(pot, budget, true) - budget > EPS) return "dreigt";
  return "ok";
}

/**
 * Saldo en uitgaven per potje, in één doorloop over de transacties.
 *
 * De groepenpagina roept groepRollup twintig keer aan, één keer per groep, en
 * bij elke toetsaanslag in het zoekveld opnieuw. Zou de rollup zelf per potje
 * over alle verrichtingen lopen, dan is dat bij honderdtwintig potjes en enkele
 * duizenden verrichtingen een merkbare hapering. Bouw dit één keer en geef het
 * door.
 *
 * Wachtende transacties tellen niet mee, net als in calcBalance en calcSpent:
 * een openstaande uitgave hoort het budget nog niet te belasten.
 */
export function bedragenPerPot(transacties: Transaction[]): PotBedragen {
  const saldi = new Map<string, number>();
  const uitgaven = new Map<string, number>();
  for (const t of transacties) {
    if (!t.potId || t.status === "pending") continue;
    saldi.set(
      t.potId,
      (saldi.get(t.potId) ?? 0) + (t.direction === "in" ? t.amount : -t.amount),
    );
    if (t.direction === "out") {
      uitgaven.set(t.potId, (uitgaven.get(t.potId) ?? 0) + t.amount);
    }
  }
  return {
    saldo: (potId) => saldi.get(potId) ?? 0,
    uitgegeven: (potId) => uitgaven.get(potId) ?? 0,
  };
}

export type PotBedragen = {
  saldo: (potId: string) => number;
  uitgegeven: (potId: string) => number;
};

/**
 * Rol de potjes van een groep op tot één budget- en één spaarbeeld.
 *
 * `potjes` moet de potjes zijn die je in het totaal wil zien. Voor een
 * hoofdgroep is dat potsInGroup(..., deep: true), net als bij het saldo ernaast,
 * anders staat het budget hier lager dan het bedrag op dezelfde regel. Tijdens
 * het zoeken geef je alleen de zichtbare potjes mee, zodat elk getal op het
 * scherm te herleiden blijft tot de regels eronder.
 */
export function groepRollup(
  potjes: Pot[],
  bedragen: PotBedragen,
): GroepRollup {
  let budget = 0;
  let uitgegeven = 0;
  let budgetPrognose = 0;
  let budgetPotjes = 0;

  let doel = 0;
  let saldo = 0;
  let doelPrognose = 0;
  let doelPotjes = 0;

  const probleemPotjes: ProbleemPot[] = [];

  for (const pot of potjes) {
    const potBudget = budgetVan(pot);
    if (potBudget !== null) {
      const potUit = bedragen.uitgegeven(pot.id);
      const potPrognose = prognoseVan(pot, potBudget, true);
      budget += potBudget;
      uitgegeven += potUit;
      budgetPrognose += potPrognose;
      budgetPotjes++;

      const teveelUit = potUit - potBudget;
      const teveelPrognose = potPrognose - potBudget;
      if (teveelUit > EPS) {
        probleemPotjes.push({ pot, stand: "over", overschrijding: teveelUit });
      } else if (teveelPrognose > EPS) {
        probleemPotjes.push({
          pot,
          stand: "dreigt",
          overschrijding: teveelPrognose,
        });
      }
      continue;
    }

    const potDoel = doelVan(pot);
    if (potDoel !== null) {
      doel += potDoel;
      saldo += bedragen.saldo(pot.id);
      doelPrognose += prognoseVan(pot, potDoel, false);
      doelPotjes++;
    }
  }

  // Wat al mis is gaat voor wat nog mis kan gaan, en binnen elke soort het
  // grootste bedrag eerst. Anders staat een overschrijding van drie euro boven
  // een van drieduizend.
  probleemPotjes.sort((a, b) => {
    if (a.stand !== b.stand) return a.stand === "over" ? -1 : 1;
    return b.overschrijding - a.overschrijding;
  });

  const budgetRollup: GroepBudget | null =
    budget > EPS
      ? {
          budget,
          uitgegeven,
          prognose: budgetPrognose,
          verschil: budgetPrognose - budget,
          potCount: budgetPotjes,
          pct: (uitgegeven / budget) * 100,
          barPct: klem((uitgegeven / budget) * 100),
          stand:
            uitgegeven - budget > EPS
              ? "over"
              : budgetPrognose - budget > EPS
                ? "dreigt"
                : "ok",
        }
      : null;

  const doelRollup: GroepDoel | null =
    Math.abs(doel) > EPS
      ? {
          doel,
          saldo,
          prognose: doelPrognose,
          verschil: doelPrognose - doel,
          potCount: doelPotjes,
          pct: (saldo / doel) * 100,
          barPct: klem((saldo / doel) * 100),
          tekort: doelPrognose - doel < -EPS,
        }
      : null;

  return {
    budget: budgetRollup,
    doel: doelRollup,
    probleemPotjes:
      budgetRollup && budgetRollup.stand !== "ok" ? probleemPotjes : [],
    stand: budgetRollup?.stand ?? "ok",
  };
}

function klem(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}
