// =============================================================================
// Voortgang van een potje , spaardoel of uitgavenbudget
// =============================================================================
// Eén plek voor de rekensom, want zowel het overzicht als de potjesdetail tonen
// dezelfde balk. Liepen die uit elkaar, dan zag je twee percentages voor
// hetzelfde potje.
//
//   'saving' : saldodoel.   voortgang = saldo / doelbedrag
//   'budget' : uitgavenplafond. voortgang = uitgaven / |budget|
//
// Een negatief doelbedrag is toegestaan. Bij een spaardoel betekent dat een
// doelsaldo onder nul: saldo en doel hebben dan hetzelfde teken, dus de deling
// geeft nog steeds een oplopend percentage. Bij een budget gebruiken we het
// absolute bedrag, zodat "500" en "-500" hetzelfde budget beschrijven.
// =============================================================================

import type { PotTargetKind } from "./types";
import { formatEuro } from "./storage";

export type PotProgress = {
  /** Werkelijk percentage. Kan boven 100 gaan bij overschrijding. */
  pct: number;
  /** Breedte van de balk, altijd tussen 0 en 100. */
  barPct: number;
  /** Label links van de balk, bv. "Budget: € 500,00". */
  label: string;
  /** Budget of doelsaldo voorbijgestoken in de verkeerde richting. */
  over: boolean;
  kind: PotTargetKind;
};

export function potProgress(
  targetAmount: number | null | undefined,
  targetKind: PotTargetKind | undefined,
  amounts: { balance: number; totalOut: number },
): PotProgress | null {
  // 0 en null betekenen beide "geen doel ingesteld".
  if (targetAmount == null || !Number.isFinite(targetAmount) || targetAmount === 0) {
    return null;
  }

  if ((targetKind ?? "saving") === "budget") {
    const budget = Math.abs(targetAmount);
    const pct = (amounts.totalOut / budget) * 100;
    return {
      pct: Math.max(0, pct),
      barPct: clamp(pct),
      label: `Budget: ${formatEuro(budget)}`,
      over: amounts.totalOut > budget,
      kind: "budget",
    };
  }

  const pct = (amounts.balance / targetAmount) * 100;
  return {
    pct: Math.max(0, pct),
    barPct: clamp(pct),
    label: `Doel: ${formatEuro(targetAmount)}`,
    // Een spaardoel voorbijsteken is goed nieuws. Een doelsaldo onder nul
    // voorbijsteken niet: dan is het potje dieper in het rood gegaan dan
    // gepland.
    over: targetAmount < 0 && amounts.balance < targetAmount,
    kind: "saving",
  };
}

function clamp(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}
